/**
 * PWA Scanner Inventaire - Native Controls Implementation
 */

// ===== Configuration =====
const CONFIG = {
    LICENSE_KEY: "DLS2eyJoYW5kc2hha2VDb2RlIjoiMTA1MDYwNTQxLU1UQTFNRFl3TlRReExYZGxZaTFVY21saGJGQnliMm8iLCJtYWluU2VydmVyVVJMIjoiaHR0cHM6Ly9tZGxzLmR5bmFtc29mdG9ubGluZS5jb20vIiwib3JnYW5pemF0aW9uSUQiOiIxMDUwNjA1NDEiLCJzdGFuZGJ5U2VydmVyVVJMIjoiaHR0cHM6Ly9zZGxzLmR5bmFtc29mdG9ubGluZS5jb20vIiwiY2hlY2tDb2RlIjo1OTU1MDkyODN9",
    STORAGE_KEY: "barcode_inventory"
};

// ===== State =====
let barcodeScanner = null;
let inventory = [];

// ===== DOM Elements =====
const el = {
    videoContainer: document.getElementById("scanner-container"),
    list: document.getElementById("inventory-list"),
    count: document.getElementById("scan-count"),
    btnToggle: document.getElementById("btn-toggle-scanner"),
    btnText: document.getElementById("btn-toggle-text"),
    notification: document.getElementById("scan-notification"),
    notificationText: document.getElementById("notification-text")
};

// ===== Initialization =====
document.addEventListener("DOMContentLoaded", () => {
    loadInventory();
    renderInventory();

    // Initial UI State
    el.videoContainer.style.display = 'none'; // Hidden by default
    el.btnToggle.classList.remove("hidden"); // Start button visible

    // Event Listeners
    el.btnToggle.addEventListener("click", startScanner);
    document.getElementById("btn-clear").addEventListener("click", clearInventory);
    document.getElementById("btn-export").addEventListener("click", exportToCSV);
});

// ===== Scanner Logic =====

async function startScanner() {
    try {
        // 1. UI Feedback: Loading
        el.btnToggle.disabled = true;
        el.btnText.textContent = "Chargement...";

        // 2. Cleanup previous instance if any
        if (barcodeScanner) {
            try { barcodeScanner.dispose(); } catch (e) { }
            barcodeScanner = null;
        }

        // 3. Configure & Create (High Level API)

        const config = {
            license: CONFIG.LICENSE_KEY,
            scanMode: Dynamsoft.EnumScanMode.SM_MULTI_UNIQUE,
            container: el.videoContainer,
            barcodeFormats: [Dynamsoft.DBR.EnumBarcodeFormat.BF_CODE_128],
            showPoweredByDynamsoft: false,
            autoStartCapturing: true,
            duplicateForgetTime: 2000,
            showResultView: false, // NO RESULT VIEW (User request)
            scannerViewConfig: {
                showCloseButton: true, // ENABLE Native Close
                showFlashButton: true,
                cameraSwitchControl: "toggleFrontBack",
            },
            onUniqueBarcodeScanned: (result) => {
                handleScan(result.text);
            }
        };

        barcodeScanner = new Dynamsoft.BarcodeScanner(config);

        // 5. Show Container & Hide Start Button
        el.videoContainer.style.display = 'block';
        el.btnToggle.classList.add("hidden"); // Hide our custom button

        // 6. Launch & Wait for Close
        // launch() promise resolves when the scanner is closed via the native button!
        await barcodeScanner.launch();

        // 7. Scanner Closed (Native 'X' clicked)
        console.log("Scanner closed via native button");
        stopScannerCleanup();

    } catch (err) {
        console.error("Scanner Error:", err);
        showNotif("Erreur: " + err.message, true);
        stopScannerCleanup();
    }
}

async function stopScannerCleanup() {
    // UI Cleanup
    el.videoContainer.style.display = 'none';
    el.btnToggle.classList.remove("hidden"); // Show Start Button again
    el.btnToggle.disabled = false;
    el.btnText.textContent = "Scanner";

    // Dispose resources to be clean
    if (barcodeScanner) {
        try {
            barcodeScanner.dispose();
            barcodeScanner = null;
        } catch (e) { console.error(e); }
    }
}


// ===== Inventory Logic =====

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
            <button class="btn btn-icon btn-delete" onclick="window.deleteItem(${item.id})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        </li>
    `).join("");
}

window.deleteItem = (id) => {
    inventory = inventory.filter(i => i.id !== id);
    saveInventory();
    renderInventory();
};

function clearInventory() {
    if (!inventory.length) return;
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
    el.notification.style.background = isError ? "#ef4444" : "#10b981";
    el.notification.classList.remove("hidden");
    setTimeout(() => el.notification.classList.add("hidden"), 2000);
}
