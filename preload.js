'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');
const inv = (c) => (...a) => ipcRenderer.invoke(c, ...a);
contextBridge.exposeInMainWorld('api', {
  openFiles: inv('dlg:files'),
  openFolder: inv('dlg:folder'),
  saveAs: inv('dlg:saveAs'),
  readDir: inv('fs:dir'),
  read: inv('fs:read'),
  write: inv('fs:write'),
  search: inv('fs:search'),
  portCheck: inv('port:check'),
  serverStart: inv('srv:start'),
  serverStop: inv('srv:stop'),
  overlay: inv('srv:overlay'),
  openExternal: inv('app:external'),
  quit: inv('app:quit'),
  run: inv('run:start'),
  kill: inv('run:kill'),
  livePhp: inv('live:php'),
  liveCs: inv('live:cs'),
  pathOf: (f) => webUtils.getPathForFile(f),
  dbg: {
    start: inv('dbg:start'),
    cmd: inv('dbg:cmd'),
    bps: inv('dbg:bps'),
    scopes: inv('dbg:scopes'),
    eval: inv('dbg:eval')
  },
  on: (ch, fn) => ipcRenderer.on(ch, (_e, d) => fn(d))
});
