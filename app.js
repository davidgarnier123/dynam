/**
 * PWA Scanner Inventaire - Application principale
 * Utilise Dynamsoft Barcode Reader pour le scan de codes-barres Code 128
 */

// ===== Configuration =====
const CONFIG = {
    LICENSE_KEY: "DLS2eyJoYW5kc2hha2VDb2RlIjoiMTA1MDYwNTQxLU1UQTFNRFl3TlRReExYZGxZaTFVY21saGJGQnliMm8iLCJtYWluU2VydmVyVVJMIjoiaHR0cHM6Ly9tZGxzLmR5bmFtc29mdG9ubGluZS5jb20vIiwib3JnYW5pemF0aW9uSUQiOiIxMDUwNjA1NDEiLCJzdGFuZGJ5U2VydmVyVVJMIjoiaHR0cHM6Ly9zZGxzLmR5bmFtc29mdG9ubGluZS5jb20vIiwiY2hlY2tDb2RlIjo1OTU1MDkyODN9",
    DUPLICATE_FORGET_TIME: 3000,
    STORAGE_KEY: "barcode_inventory"
};

// ===== État Global =====
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
    updateToggleButton(false);
});

function setupEventListeners() {
    elements.btnToggle.addEventListener("click", toggleScanner);
    elements.btnClear.addEventListener("click", clearInventory);
    elements.btnExport.addEventListener("click", exportToCSV);
}

// ===== Logique du Scanner =====

async function startScanning() {
    if (isScanning || barcodeScanner) return;

    try {
        console.log("Démarrage du scanner...");
        updateToggleButton(true, "Chargement...");
        elements.btnToggle.disabled = true;

        // 1. Vérifier si Dynamsoft est chargé
        if (typeof Dynamsoft === "undefined") {
            throw new Error("La librairie Dynamsoft n'est pas chargée. Vérifiez votre connexion internet.");
        }

        // 2. Afficher le container (pour le feedback visuel)
        elements.scannerContainer.classList.remove("hidden");

        // 3. Configuration & Création de l'instance
        // On recrée l'instance à chaque démarrage pour éviter les états incohérents
        const config = {
            license: CONFIG.LICENSE_KEY,
            scanMode: Dynamsoft.EnumScanMode.SM_MULTI_UNIQUE,
            barcodeFormats: [Dynamsoft.DBR.EnumBarcodeFormat.BF_CODE_128],
            duplicateForgetTime: CONFIG.DUPLICATE_FORGET_TIME,
            showPoweredByDynamsoft: false,
            autoStartCapturing: true, // Important pour le mode continu
            showUploadImageButton: false,
            showResultView: false,
            container: elements.scannerContainer,
            scannerViewConfig: {
                showCloseButton: false,
                showFlashButton: true,
                cameraSwitchControl: "toggleFrontBack",
                // Optionnel: configurer la zone de scan si besoin
            },
            onUniqueBarcodeScanned: (result) => {
                handleBarcodeScanned(result);
            },
            onInitReady: (components) => {
                components.cameraView.setScanLaserVisible(true);
            },
            onCameraOpen: () => {
                console.log("Caméra active");
            }
        };

        barcodeScanner = new Dynamsoft.BarcodeScanner(config);

        // 4. Lancement
        await barcodeScanner.launch();

        isScanning = true;
        updateToggleButton(true, "Arrêter");
        console.log("Scanner démarré avec succès");

    } catch (error) {
        console.error("Erreur startScanning:", error);
        showNotification("Erreur: " + error.message, true);
        stopScanning(); // Nettoyage en cas d'erreur
    } finally {
        elements.btnToggle.disabled = false;
    }
}

function stopScanning() {
    console.log("Arrêt du scanner...");

    // 1. Dispose de l'instance scanner
    if (barcodeScanner) {
        try {
            barcodeScanner.dispose();
            console.log("Instance scanner détruite");
        } catch (e) {
            console.error("Erreur destruction scanner:", e);
        }
        barcodeScanner = null;
    }

    // 2. Masquer le container
    elements.scannerContainer.classList.add("hidden");

    // 3. Nettoyer le container DOM par sécurité (pour supprimer d'éventuels iframes/videos orphelins)
    // Attention: le spinner est dans le HTML statique, donc on ne vide pas tout brutalement si on veut le garder
    // Mais Dynamsoft ajoute ses éléments, donc on peut vouloir reset.
    // Pour l'instant on se fie à dispose() et au CSS hidden.

    // 4. Reset état
    isScanning = false;
    updateToggleButton(false, "Démarrer");
    elements.btnToggle.disabled = false;
}

function toggleScanner() {
    if (isScanning) {
        stopScanning();
    } else {
        startScanning();
    }
}

function updateToggleButton(active, text) {
    elements.btnToggle.classList.toggle("active", active);
    if (text) {
        elements.btnToggleText.textContent = text;
    } else {
        elements.btnToggleText.textContent = active ? "Arrêter" : "Démarrer";
    }
}

// ===== Gestion Inventaire =====

function handleBarcodeScanned(result) {
    const code = result.text;
    console.log("Scan:", code);

    const item = {
        id: Date.now(),
        code: code,
        format: result.formatString || "CODE_128",
        timestamp: new Date().toISOString()
    };

    inventory.unshift(item);
    saveInventory();
    renderInventory();
    showNotification(code);

    if (navigator.vibrate) {
        navigator.vibrate(100);
    }
}

function renderInventory() {
    elements.scanCount.textContent = inventory.length;

    if (inventory.length === 0) {
        elements.inventoryList.innerHTML = `
            <li class="empty-state">
                <span class="empty-icon">📷</span>
                <p>Scannez un code-barres pour commencer</p>
            </li>`;
        return;
    }

    elements.inventoryList.innerHTML = inventory.map(item => `
        <li class="inventory-item">
            <div>
                <span class="item-code">${escapeHtml(item.code)}</span>
                <span class="item-time">${new Date(item.timestamp).toLocaleTimeString("fr-FR")}</span>
            </div>
            <button class="btn btn-icon btn-delete" onclick="window.deleteItem(${item.id})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </li>
    `).join("");
}

// Exposer deleteItem globalement pour le onclick
window.deleteItem = function (id) {
    inventory = inventory.filter(i => i.id !== id);
    saveInventory();
    renderInventory();
};

function clearInventory() {
    if (inventory.length > 0 && confirm("Tout effacer ?")) {
        inventory = [];
        saveInventory();
        renderInventory();
        showNotification("Lise effacée");
    }
}

function exportToCSV() {
    if (inventory.length === 0) return showNotification("Rien à exporter", true);

    const csv = [
        "Code;Format;Date;Heure",
        ...inventory.map(i => {
            const d = new Date(i.timestamp);
            return `${i.code};${i.format};${d.toLocaleDateString()};${d.toLocaleTimeString()}`;
        })
    ].join("\n");

    const blob = new Blob(["\ufeff" + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventaire-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ===== Persistance & Utils =====

function saveInventory() {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(inventory));
}

function loadInventory() {
    try {
        const data = localStorage.getItem(CONFIG.STORAGE_KEY);
        if (data) inventory = JSON.parse(data);
    } catch (e) { console.error(e); }
}

function showNotification(msg, isError = false) {
    elements.notificationText.textContent = msg;
    elements.notification.style.background = isError ? "#ef4444" : "#10b981";
    elements.notification.classList.remove("hidden");
    setTimeout(() => elements.notification.classList.add("hidden"), 2000);
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}
