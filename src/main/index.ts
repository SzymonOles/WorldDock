import { app, shell, BrowserWindow, ipcMain, Menu } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.MAIN_VITE_SUPABASE_URL,
  import.meta.env.MAIN_VITE_SUPABASE_PUBLISHABLE_KEY,
);

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.removeMenu()
  mainWindow.maximize()

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  ipcMain.handle('get-ports', async (_event, bounds) => {
    try {
      const { data, error } = await supabase
        .from('port_maps')
        .select('id, name, center_lng, center_lat')
        .gte('center_lng', bounds.minLng)
        .lte('center_lng', bounds.maxLng)
        .gte('center_lat', bounds.minLat)
        .lte('center_lat', bounds.maxLat)
        .limit(100);

      if (error) throw error;
      return { success: true, ports: data };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('get-port-details', async (_event, portId) => {
    try {
      const { data: portData, error: portError } = await supabase
        .from('port_maps')
        .select('*')
        .eq('id', portId)
        .single();

      if (portError) throw portError;

      const { data: shapesData, error: shapesError } = await supabase
        .from('port_shapes')
        .select('id, raw_points')
        .eq('port_id', portId);

      if (shapesError) throw shapesError;

      return {
        success: true,
        port: portData,
        shapes: shapesData
      };
    } catch (err: any) {
      console.error('Błąd pobierania danych portu:', err);
      return {
        success: false,
        message: err.message || 'Nie udało się pobrać danych portu z Supabase.'
      };
    }
  });

  ipcMain.handle('save-port-map', async (_event, payload) => {
    try {
      const { data: portData, error: portError } = await supabase
        .from('port_maps')
        .insert([{
          name: "WorldDock Port",
          center_lng: payload.location.lng,
          center_lat: payload.location.lat,
          zoom_level: payload.zoom,
          tile_quality: payload.quality,
          start_point_json: payload.startPoint
        }])
        .select()
        .single();

      if (portError) throw portError;

      const shapesToInsert = payload.polygons.map((poly: any) => ({
        port_id: portData.id,
        raw_points: poly
      }));

      const { error: shapesError } = await supabase
        .from('port_shapes')
        .insert(shapesToInsert);

      if (shapesError) throw shapesError;

      return { success: true };
    } catch (err: any) {
      console.error('Błąd zapisu:', err);
      return {
        success: false,
        message: err.message || 'Błąd komunikacji z bazą'
      };
    }
  });

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
