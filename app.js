/**
 * PWA Scanner Inventaire - Application principale
 * Utilise Dynamsoft Barcode Reader pour le scan de codes-barres Code 128
 */

// ===== Configuration =====
const CONFIG = {
    // IMPORTANT: Remplacez par votre clé API Dynamsoft
    LICENSE_KEY: "DLS2eyJoYW5kc2hha2VDb2RlIjoiMTA1MDYwNTQxLU1UQTFNRFl3TlRReExYZGxZaTFVY21saGJGQnliMm8iLCJtYWluU2VydmVyVVJMIjoiaHR0cHM6Ly9tZGxzLmR5bmFtc29mdG9ubGluZS5jb20vIiwib3JnYW5pemF0aW9uSUQiOiIxMDUwNjA1NDEiLCJzdGFuZGJ5U2VydmVyVVJMIjoiaHR0cHM6Ly9zZGxzLmR5bmFtc29mdG9ubGluZS5jb20vIiwiY2hlY2tDb2RlIjo1OTU1MDkyODN9",

    // Temps avant qu'un code identique puisse être scanné à nouveau (ms)
    DUPLICATE_FORGET_TIME: 3000,

    // Clé localStorage pour persister l'inventaire
    STORAGE_KEY: "barcode_inventory"
};

// ===== État de l'application =====
let barcodeScanner = null;
let isScanning = false;
let inventory = [];

// ===== Éléments DOM =====
const elements = {
    scannerContainer: document.getElementById("scanner-container"),
    inventoryList: document.getElementById("inventory-list"),
    scanCount: document.getElementById("scan-count"),
    btnToggle: document.getElementById("btn-toggle-scanner"),
    btnToggleText: document.getElementById("btn-toggle-text"),
    btnClear: document.getElementById("btn-clear"),
    btnExport: document.getElementById("btn-export"),
    notification: document.getElementById("scan-notification"),
    notificationText: document.getElementById("notification-text")
};

// ===== Initialisation =====
document.addEventListener("DOMContentLoaded", () => {
    loadInventory();
    renderInventory();
    setupEventListeners();
    // On initialise le scanner mais sans le démarrer
    // initScanner(); // On laisse le bouton gérer l'init
    updateToggleButton(false);
});

// ===== Configuration des événements =====
function setupEventListeners() {
    elements.btnToggle.addEventListener("click", toggleScanner);
    elements.btnClear.addEventListener("click", clearInventory);
    elements.btnExport.addEventListener("click", exportToCSV);
}

// ===== Scanner Dynamsoft =====
async function initScanner() {
    try {
        // Configuration du scanner
        const config = {
            license: CONFIG.LICENSE_KEY,

            // Mode scan multiple unique - continue de scanner
            scanMode: Dynamsoft.EnumScanMode.SM_MULTI_UNIQUE,

            // Uniquement Code 128
            barcodeFormats: [Dynamsoft.DBR.EnumBarcodeFormat.BF_CODE_128],

            // Temps avant qu'un doublon puisse être signalé
            duplicateForgetTime: CONFIG.DUPLICATE_FORGET_TIME,

            // Masquer le bouton powered by
            showPoweredByDynamsoft: false,

            // Démarrer automatiquement la capture une fois la caméra ouverte (Requis pour SM_MULTI_UNIQUE)
            autoStartCapturing: true,

            // Masquer le bouton d'upload d'image
            showUploadImageButton: false,

            // Désactiver la vue résultat intégrée (on gère notre propre liste)
            showResultView: false,

            // Container pour le scanner
            container: elements.scannerContainer,

            // Configuration de la vue scanner
            scannerViewConfig: {
                showCloseButton: false,
                showFlashButton: true,
                cameraSwitchControl: "toggleFrontBack"
            },

            // Callback appelé à chaque nouveau code unique détecté
            onUniqueBarcodeScanned: (result) => {
                handleBarcodeScanned(result);
            },

            // Callback quand le scanner est prêt
            onInitReady: (components) => {
                console.log("Scanner initialisé et prêt");
                // Activer le laser de scan pour feedback visuel
                components.cameraView.setScanLaserVisible(true);
            },

            // Callback quand la caméra s'ouvre
            onCameraOpen: () => {
                console.log("Caméra ouverte");
                updateToggleButton(true);
            }
        };

        // Créer l'instance du scanner
        barcodeScanner = new Dynamsoft.BarcodeScanner(config);

        // Ne pas lancer le scanner automatiquement ici. 
        // L'initialisation est faite, mais le lancement (launch) sera géré par toggleScanner/startScanner
        console.log("Scanner initialisé.");

    } catch (error) {
        console.error("Erreur initialisation scanner:", error);
        showNotification("Erreur: " + error.message, true);
    }
}

async function startScanner() {
    if (!barcodeScanner) return;

    try {
        elements.btnToggle.disabled = true;
        elements.btnToggleText.textContent = "Chargement...";

        if (isScanning) {
            console.log("Launch annulé car déjà arrêté");
            return;
        }

        await barcodeScanner.launch();

        isScanning = true;
        updateToggleButton(true);
    } catch (error) {
        // ... (reste du catch)
        console.error("Erreur démarrage scanner:", error);

        // Si l'utilisateur a annulé, ce n'est pas une erreur
        if (error.message && error.message.includes("cancelled")) {
            updateToggleButton(false);
        } else {
            showNotification("Erreur caméra: " + error.message, true);
        }
    } finally {
        elements.btnToggle.disabled = false;
    }
}

function stopScanner() {
    if (barcodeScanner) {
        try {
            barcodeScanner.dispose();
        } catch (e) {
            console.error("Erreur dispose:", e);
        }
        barcodeScanner = null;
    }
    isScanning = false;
    updateToggleButton(false);

    // On ne relance PAS initScanner ici, sinon ça repart en boucle si on avait un auto-start.
    // L'initialisation se fera au prochain click sur Démarrer.
}

function toggleScanner() {
    if (isScanning) {
        stopScanner();
    } else {
        // Si le scanner n'existe pas encore, on l'initialise et on le lance
        if (!barcodeScanner) {
            initScanner().then(() => startScanner());
        } else {
            startScanner();
        }
    }
}


function updateToggleButton(scanning) {
    isScanning = scanning;
    elements.btnToggleText.textContent = scanning ? "Arrêter" : "Démarrer";
    elements.btnToggle.classList.toggle("active", scanning);
}

// ===== Gestion des codes-barres scannés =====
function handleBarcodeScanned(result) {
    const barcodeText = result.text;
    const timestamp = new Date();

    // Ajouter à l'inventaire
    const item = {
        id: Date.now(),
        code: barcodeText,
        format: result.formatString || "CODE_128",
        timestamp: timestamp.toISOString()
    };

    inventory.unshift(item);
    saveInventory();
    renderInventory();

    // Notification visuelle
    showNotification(barcodeText);

    // Vibration si supportée
    if (navigator.vibrate) {
        navigator.vibrate(100);
    }

    console.log("Code scanné:", barcodeText);
}

// ===== Affichage de l'inventaire =====
function renderInventory() {
    elements.scanCount.textContent = inventory.length;

    if (inventory.length === 0) {
        elements.inventoryList.innerHTML = `
            <li class="empty-state">
                <span class="empty-icon">📷</span>
                <p>Scannez un code-barres pour commencer</p>
            </li>
        `;
        return;
    }

    elements.inventoryList.innerHTML = inventory.map(item => {
        const time = new Date(item.timestamp);
        const timeStr = time.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit"
        });

        return `
            <li class="inventory-item" data-id="${item.id}">
                <div>
                    <span class="item-code">${escapeHtml(item.code)}</span>
                    <span class="item-time">${timeStr}</span>
                </div>
                <button class="btn btn-icon btn-delete" onclick="deleteItem(${item.id})" title="Supprimer">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </li>
        `;
    }).join("");
}

function deleteItem(id) {
    inventory = inventory.filter(item => item.id !== id);
    saveInventory();
    renderInventory();
}

function clearInventory() {
    if (inventory.length === 0) return;

    if (confirm("Effacer tous les codes scannés ?")) {
        inventory = [];
        saveInventory();
        renderInventory();
        showNotification("Liste effacée");
    }
}

// ===== Persistance localStorage =====
function saveInventory() {
    try {
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(inventory));
    } catch (e) {
        console.error("Erreur sauvegarde:", e);
    }
}

function loadInventory() {
    try {
        const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
        if (saved) {
            inventory = JSON.parse(saved);
        }
    } catch (e) {
        console.error("Erreur chargement:", e);
        inventory = [];
    }
}

// ===== Export CSV =====
function exportToCSV() {
    if (inventory.length === 0) {
        showNotification("Aucun code à exporter", true);
        return;
    }

    const headers = ["Code", "Format", "Date", "Heure"];
    const rows = inventory.map(item => {
        const date = new Date(item.timestamp);
        return [
            item.code,
            item.format,
            date.toLocaleDateString("fr-FR"),
            date.toLocaleTimeString("fr-FR")
        ];
    });

    const csvContent = [
        headers.join(";"),
        ...rows.map(row => row.join(";"))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `inventaire_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification(`${inventory.length} codes exportés`);
}

// ===== Notifications =====
let notificationTimeout = null;

function showNotification(message, isError = false) {
    elements.notificationText.textContent = message;
    elements.notification.style.background = isError ? "#ef4444" : "#10b981";
    elements.notification.classList.remove("hidden");

    clearTimeout(notificationTimeout);
    notificationTimeout = setTimeout(() => {
        elements.notification.classList.add("hidden");
    }, 2000);
}

// ===== Utilitaires =====
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}
