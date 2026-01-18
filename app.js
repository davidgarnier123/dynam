/**
 * PWA Scanner Inventaire - Application principale
 * Documentation based implementation
 */

// ===== Configuration =====
const CONFIG = {
    LICENSE_KEY: "DLS2eyJoYW5kc2hha2VDb2RlIjoiMTA1MDYwNTQxLU1UQTFNRFl3TlRReExYZGxZaTFVY21saGJGQnliMm8iLCJtYWluU2VydmVyVVJMIjoiaHR0cHM6Ly9tZGxzLmR5bmFtc29mdG9ubGluZS5jb20vIiwib3JnYW5pemF0aW9uSUQiOiIxMDUwNjA1NDEiLCJzdGFuZGJ5U2VydmVyVVJMIjoiaHR0cHM6Ly9zZGxzLmR5bmFtc29mdG9ubGluZS5jb20vIiwiY2hlY2tDb2RlIjo1OTU1MDkyODN9",
    STORAGE_KEY: "barcode_inventory"
};

// ===== Variables Globales =====
let barcodeScanner = null;
let inventory = [];

// ===== Éléments DOM =====
const el = {
    videoContainer: document.getElementById("scanner-container"),
    list: document.getElementById("inventory-list"),
    count: document.getElementById("scan-count"),
    btnToggle: document.getElementById("btn-toggle-scanner"),
    btnText: document.getElementById("btn-toggle-text"),
    notification: document.getElementById("scan-notification"),
    notificationText: document.getElementById("notification-text")
};

// ===== Initialisation =====
document.addEventListener("DOMContentLoaded", () => {
    loadInventory();
    renderInventory();

    // Initial state: hidden
    el.videoContainer.style.display = 'none';

    // Buttons
    el.btnToggle.addEventListener("click", toggleScanner);
    document.getElementById("btn-clear").addEventListener("click", clearInventory);
    document.getElementById("btn-export").addEventListener("click", exportToCSV);
});

// ===== Logic Scanner =====

async function toggleScanner() {
    // Si déjà actif => On arrête
    if (el.btnToggle.classList.contains("active")) {
        await stopScanner();
        return;
    }

    // Sinon => On démarre
    await startScanner();
}

async function startScanner() {
    try {
        setButtonState("loading");

        // 1. Initialisation (si null)
        if (!barcodeScanner) {
            /** @type {BarcodeScannerConfig} */
            const config = {
                license: CONFIG.LICENSE_KEY,
                // Scan continu
                scanMode: Dynamsoft.EnumScanMode.SM_MULTI_UNIQUE,
                // Container
                container: el.videoContainer,
                // UI & Formats
                barcodeFormats: [Dynamsoft.DBR.EnumBarcodeFormat.BF_CODE_128],
                showPoweredByDynamsoft: false,
                autoStartCapturing: true,
                duplicateForgetTime: 2000,
                // UI Config
                scannerViewConfig: {
                    showCloseButton: false, // On utilise notre propre bouton
                    showFlashButton: true,
                    cameraSwitchControl: "toggleFrontBack",
                },
                onUniqueBarcodeScanned: (result) => {
                    handleScan(result.text);
                },
                onInitReady: (comps) => {
                    comps.cameraView.setScanLaserVisible(true);
                }
            };

            barcodeScanner = new Dynamsoft.BarcodeScanner(config);
        }

        // 2. Afficher la zone AVANT de lancer (pour voir le spinner CSS si présent)
        el.videoContainer.style.display = 'block';

        // 3. Lancer
        await barcodeScanner.launch();

        setButtonState("scanning");

    } catch (err) {
        console.error("Start Error:", err);
        showNotif("Erreur: " + err.message, true);
        await stopScanner(); // Fallback
    }
}

async function stopScanner() {
    try {
        setButtonState("loading"); // Feedback immédiat

        if (barcodeScanner) {
            // dispose() est la méthode radicale mais sûre pour tout nettoyer (caméra, ui, workers)
            barcodeScanner.dispose();
            barcodeScanner = null;
        }

    } catch (err) {
        console.error("Stop Error:", err);
    } finally {
        // UI Clean up
        el.videoContainer.style.display = 'none';
        setButtonState("stopped");
    }
}

// ===== UI Extras =====

function setButtonState(state) {
    el.btnToggle.disabled = (state === "loading");

    if (state === "loading") {
        el.btnText.textContent = "Chargement...";
        el.btnToggle.classList.remove("active");
    } else if (state === "scanning") {
        el.btnText.textContent = "Arrêter";
        el.btnToggle.classList.add("active");
        // IMPORTANT: z-index très haut pour passer au dessus de la vidéo
        el.btnToggle.style.zIndex = "99999";
    } else {
        el.btnText.textContent = "Démarrer";
        el.btnToggle.classList.remove("active");
    }
}

// ===== Inventory Logic (inchangé, simplifié) =====

function handleScan(code) {
    const item = {
        id: Date.now(),
        code: code,
        timestamp: new Date().toISOString()
    };
    inventory.unshift(item);
    saveInventory();
    renderInventory();
    showNotif(code);
    if (navigator.vibrate) navigator.vibrate(100);
}

function renderInventory() {
    el.count.textContent = inventory.length;

    if (inventory.length === 0) {
        el.list.innerHTML = `<li class="empty-state">📷 <p>Prêt à scanner</p></li>`;
        return;
    }

    el.list.innerHTML = inventory.map(item => `
        <li class="inventory-item">
            <div>
                <span class="item-code">${item.code}</span>
                <span class="item-time">${new Date(item.timestamp).toLocaleTimeString("fr-FR")}</span>
            </div>
            <button class="btn btn-icon btn-delete" onclick="deleteItem(${item.id})">🗑️</button>
        </li>
    `).join("");
}

window.deleteItem = (id) => {
    inventory = inventory.filter(i => i.id !== id);
    saveInventory();
    renderInventory();
};

function clearInventory() {
    if (confirm("Tout effacer ?")) {
        inventory = [];
        saveInventory();
        renderInventory();
    }
}

function exportToCSV() {
    if (!inventory.length) return showNotif("Rien à exporter", true);
    const csv = "Code;Date\n" + inventory.map(i => `${i.code};${i.timestamp}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "scan.csv";
    a.click();
}

function saveInventory() { localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(inventory)); }
function loadInventory() {
    try { inventory = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || "[]"); }
    catch { inventory = []; }
}

function showNotif(msg, isError = false) {
    el.notificationText.textContent = msg;
    el.notification.style.background = isError ? "red" : "green";
    el.notification.classList.remove("hidden");
    setTimeout(() => el.notification.classList.add("hidden"), 2000);
}
