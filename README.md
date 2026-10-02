# C

A lightweight dark code editor built with Electron. It has a real-time sandbox, an Explorer, search, and a JavaScript debugger. It is designed to use little RAM.

## Features

- Dark theme with VS Code style syntax colors
- Open File, Open Folder, Save, Save as, and drag and drop
- Opens any file extension as text (binary files and files over 10 MB are refused)
- Explorer tree and search inside the opened folder
- Real-time sandbox for **C#, JavaScript, HTML and PHP**
- Local sandbox server with live reload (Host, Status Port and Bind Port settings)
- JavaScript debugger: breakpoints, step over / into / out, call stack, variables, expression evaluation
- Problems panel and error / warning counters in the status bar

## Requirements

- [Node.js](https://nodejs.org) 18 or newer (includes npm)
- Optional, only for the sandbox languages:
  - PHP in your PATH, to run PHP files
  - .NET SDK (`dotnet`) in your PATH, to run C# files

HTML and JavaScript need nothing extra.

## How to start the program

Windows: double-click `start.bat`

macOS / Linux:

```sh
chmod +x start.sh
./start.sh
```

Or use npm directly:

```sh
npm install
npm start
```

The first run downloads Electron, so it can take a minute.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| Ctrl+O | Open file |
| Ctrl+Shift+O | Open folder |
| Ctrl+S | Save |
| Ctrl+Shift+S | Save as |
| Ctrl+N | New file |
| Ctrl+W | Close tab |
| Ctrl+Shift+F | Search in folder |
| F5 | Run (or continue while debugging) |
| Shift+F5 | Stop |
| F6 | Start debugging |
| F9 | Toggle breakpoint |
| F10 | Step over |
| F11 / Shift+F11 | Step into / step out |

## Sandbox notes

| Language | While typing (real-time) | Run (F5) |
| --- | --- | --- |
| HTML | Live preview | Preview |
| JavaScript | Runs in an isolated worker, stopped after 3 seconds, no DOM or Node APIs | Runs with Node |
| PHP | Runs in restricted mode (file writes and shell functions disabled) | Runs without restrictions |
| C# | Compile error check only | Builds and runs with `dotnet` |

Bind Port starts a local server for the opened folder (or the folder of the current file) on the address you enter, for example `localhost:2000`.

## How to push this project to GitHub

1. Create a new empty repository on GitHub (do not add a README, .gitignore or license there).
2. Open a terminal in the project folder and run:

```sh
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

3. Replace `YOUR-USERNAME` and `YOUR-REPO` with your own values.

If GitHub asks for a password, use a personal access token (Settings > Developer settings > Personal access tokens) or sign in with GitHub CLI (`gh auth login`).

### Pushing later changes

```sh
git add .
git commit -m "Describe your change"
git push
```

### Uploading without git

On your repository page, click **Add file > Upload files**, drag in the project files (not the `node_modules` folder), then click **Commit changes**.

## Project structure

```
main.js            Electron main process (files, server, runners, debugger)
preload.js         Safe bridge between main and renderer
renderer/          Editor UI (index.html, style.css, app.js, highlight.js)
start.bat          Windows launcher
start.sh           macOS / Linux launcher
```

## License

MIT. See `LICENSE`.
