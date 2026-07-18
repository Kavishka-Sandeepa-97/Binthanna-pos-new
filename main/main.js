const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const expressServer = require('./server');
const { initializeDatabase, closeDatabase } = require('./database/init');
const fs = require('fs');
const { exec } = require('child_process');
const os = require('os');
const { startSyncScheduler, stopSyncScheduler, runSync } = require('./services/syncService');

let mainWindow;
let server;
let tempFileCleanupInterval = null;

// Helper function to get the current main window
function getMainWindow() {
  return mainWindow;
}

// Clean up old temporary receipt files
function cleanupTempFiles() {
  const tempDir = os.tmpdir();
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000); // 1 hour in milliseconds

  try {
    const files = fs.readdirSync(tempDir);
    let cleanedCount = 0;

    files.forEach(file => {
      if (file.startsWith('receipt-') && file.endsWith('.txt')) {
        const filePath = path.join(tempDir, file);
        try {
          const stats = fs.statSync(filePath);
          if (stats.mtimeMs < oneHourAgo) {
            fs.unlinkSync(filePath);
            cleanedCount++;
          }
        } catch (err) {
          // Ignore errors for individual files
        }
      }
    });

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} old receipt files`);
    }
  } catch (err) {
    console.error('Error cleaning temp files:', err);
  }
}

// Start periodic temp file cleanup (every hour)
function startTempFileCleanup() {
  // Run immediately
  cleanupTempFiles();

  // Then run every hour
  tempFileCleanupInterval = setInterval(() => {
    cleanupTempFiles();
  }, 60 * 60 * 1000); // 1 hour

  console.log('Temp file cleanup schedule started');
}

// Stop temp file cleanup
function stopTempFileCleanup() {
  if (tempFileCleanupInterval) {
    clearInterval(tempFileCleanupInterval);
    tempFileCleanupInterval = null;
    console.log('Temp file cleanup schedule stopped');
  }
}

// ============ Printer IPC Handlers ============
// Register IPC handlers once when app is ready

function registerIPCHandlers() {
  // Check if printer is available
  ipcMain.handle('check-printer', async (event, printerName) => {
    try {
      // Use PowerShell to get printers (more reliable on Windows)
      return new Promise((resolve) => {
        const command = `powershell -Command "Get-Printer | Select-Object Name, Status, DriverName | ConvertTo-Json"`;

        exec(command, (error, stdout, stderr) => {
          if (error) {
            resolve({ connected: false, error: error.message });
            return;
          }

          try {
            let printers = [];
            if (stdout.trim()) {
              // Parse the JSON output
              const parsed = JSON.parse(stdout.trim());
              // If single object, wrap in array
              printers = Array.isArray(parsed) ? parsed : [parsed];
            }

            // Check if the requested printer exists and is online (case-insensitive)
            const printer = printers.find(p => p.Name.toLowerCase() === printerName.toLowerCase());

            // Consider printer connected if it exists and status is not explicitly offline/error
            const isConnected = printer && (!printer.Status || printer.Status.toLowerCase() !== 'offline' && printer.Status.toLowerCase() !== 'error');

            resolve({
              connected: isConnected,
              printer: printer,
              printers: printers.map(p => ({
                name: p.Name,
                displayName: p.Name,
                status: p.Status,
                driver: p.DriverName
              }))
            });
          } catch (parseError) {
            resolve({ connected: false, error: 'Failed to parse printer list' });
          }
        });
      });
    } catch (error) {
      return { connected: false, error: error.message };
    }
  });

  // Print receipt/bill using HTML (silent print to selected printer)
  ipcMain.handle('print-receipt', async (event, { content, printerName }) => {
    try {
      const printWin = new BrowserWindow({
        show: false,
        width: 350,
        height: 800,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
      });

      await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(content)}`);

      const normalizeName = (name) => (name || '')
        .toString()
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();

      const simplifyName = (name) => normalizeName(name)
        .replace(/\(copy\s*\d+\)/g, '')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const requestedName = normalizeName(printerName);
      let resolvedDeviceName = '';

      try {
        const availablePrinters = await printWin.webContents.getPrintersAsync();
        const normalizedRequested = requestedName;
        const simplifiedRequested = simplifyName(printerName);

        const exactMatch = availablePrinters.find((printer) => normalizeName(printer.name) === normalizedRequested);
        if (exactMatch) {
          resolvedDeviceName = exactMatch.name;
        } else if (normalizedRequested) {
          const broadMatch = availablePrinters.find((printer) => {
            const normalizedPrinter = normalizeName(printer.name);
            return normalizedPrinter.includes(normalizedRequested) || normalizedRequested.includes(normalizedPrinter);
          });
          if (broadMatch) {
            resolvedDeviceName = broadMatch.name;
          }
        }

        if (!resolvedDeviceName && simplifiedRequested) {
          const familyTokens = simplifiedRequested.split(' ').filter((token) => token.length >= 2);
          const tokenMatch = availablePrinters.find((printer) => {
            const simplifiedPrinter = simplifyName(printer.name);
            return familyTokens.every((token) => simplifiedPrinter.includes(token));
          });
          if (tokenMatch) {
            resolvedDeviceName = tokenMatch.name;
          }
        }

        if (!resolvedDeviceName && normalizedRequested.includes('xp-80c')) {
          const familyMatch = availablePrinters.find((printer) => normalizeName(printer.name).includes('xp-80c'));
          if (familyMatch) {
            resolvedDeviceName = familyMatch.name;
          }
        }

        if (!resolvedDeviceName && normalizedRequested.includes('xp-h500b')) {
          const familyMatch = availablePrinters.find((printer) => normalizeName(printer.name).includes('xp-h500b'));
          if (familyMatch) {
            resolvedDeviceName = familyMatch.name;
          }
        }

        if (!resolvedDeviceName && requestedName) {
          const availableNames = availablePrinters.map((printer) => printer.name).join(', ');
          printWin.close();
          return {
            success: false,
            error: `Selected printer not found: ${printerName}. Available printers: ${availableNames || 'none'}`,
          };
        }
      } catch (printerLookupError) {
        // Continue with fallback printing if printer list fetch fails.
      }

      return new Promise((resolve) => {
        // Small delay to let content render
        setTimeout(() => {
          const printOptions = {
            silent: true,
            printBackground: true,
            margins: { marginType: 'none' }
          };

          // Only pass deviceName when it is resolved from Electron's printer list.
          if (resolvedDeviceName) {
            printOptions.deviceName = resolvedDeviceName;
          }

          printWin.webContents.print(
            printOptions,
            (success, failureReason) => {
              printWin.close();
              if (success) {
                resolve({
                  success: true,
                  message: resolvedDeviceName
                    ? `Printed successfully via ${resolvedDeviceName}`
                    : 'Printed successfully via default printer',
                });
              } else {
                resolve({ success: false, error: failureReason || 'Print failed' });
              }
            }
          );
        }, 200);
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Get available printers
  ipcMain.handle('get-printers', async (event) => {
    try {
      // Use PowerShell to get printers
      return new Promise((resolve) => {
        const command = `powershell -Command "Get-Printer | Select-Object Name, Status, DriverName | ConvertTo-Json"`;

        exec(command, (error, stdout, stderr) => {
          if (error) {
            resolve([]);
            return;
          }

          try {
            let printers = [];
            if (stdout.trim()) {
              const parsed = JSON.parse(stdout.trim());
              printers = Array.isArray(parsed) ? parsed : [parsed];
            }

            const result = printers.map(p => ({
              name: p.Name,
              displayName: p.Name,
              status: p.Status,
              driver: p.DriverName,
              isDefault: false // PowerShell doesn't easily give default, but we can check status
            }));

            resolve(result);
          } catch (parseError) {
            resolve([]);
          }
        });
      });
    } catch (error) {
      return [];
    }
  });

  console.log('IPC handlers registered');
}

function createWindow() {
  // Initialize database first
  initializeDatabase();

  // Start background database sync scheduler
  startSyncScheduler();

  // Start Express server
  server = expressServer.listen(3002, () => {
    console.log('Express server running on port 3002');
  });

  // Set server timeout to prevent hanging connections
  server.timeout = 30000; // 30 seconds
  server.keepAliveTimeout = 65000; // 65 seconds

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, '../render/public/vite.svg'),
    show: false // Don't show until ready
  });

  // Determine if we're in development or production
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    // Development: Load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');

    // Open DevTools in development
    mainWindow.webContents.openDevTools();

    // Reload on changes (optional - Vite handles this automatically)
    mainWindow.webContents.on('did-fail-load', () => {
      setTimeout(() => {
        mainWindow.loadURL('http://localhost:5173');
      }, 1000);
    });
  } else {
    // Production: Load from built files
    mainWindow.loadFile(path.join(__dirname, '../render/dist/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    if (isDev) {
      console.log('🚀 Development mode: Loading from Vite dev server');
      console.log('📱 Frontend: http://localhost:5173');
      console.log('🔧 Backend API: http://localhost:3002');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Start temp file cleanup
  startTempFileCleanup();
}

// Wait for app to be ready
app.whenReady().then(() => {
  // Register IPC handlers once
  registerIPCHandlers();

  createWindow();

  try {
    // Remove default application menu (File/Edit/View/Window/Help)
    Menu.setApplicationMenu(null);
  } catch (err) {
    console.warn('Could not remove application menu:', err.message);
  }
});

// Graceful shutdown handler
app.on('before-quit', async (event) => {
  console.log('Application shutting down...');

  // Prevent default quit to allow cleanup
  event.preventDefault();

  try {
    // Stop temp file cleanup
    stopTempFileCleanup();

    // Stop sync background scheduler
    stopSyncScheduler();

    // Perform final sync run before exit (timeout or fail gracefully)
    try {
      await runSync();
    } catch (syncErr) {
      console.error('Final sync failed on exit:', syncErr.message);
    }

    // Close Express server
    if (server) {
      await new Promise((resolve) => {
        server.close(() => {
          console.log('Express server closed');
          resolve();
        });
      });
    }

    // Close database
    await closeDatabase();

    console.log('Cleanup completed, exiting...');

    // Now actually quit
    app.exit(0);
  } catch (err) {
    console.error('Error during cleanup:', err);
    app.exit(1);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle certificate errors in development
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (process.env.NODE_ENV === 'development') {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});