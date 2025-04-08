#!/usr/bin/node

const { spawn } = require('child_process');

const chromiumProcess = spawn('/bin/bash', ['/config/.config/openbox/autostart'], { stdio: 'pipe' });
chromiumProcess.on('error', (err) => {console.error('Failed to start Chromium:', err);});
chromiumProcess.on('close', (code, signal) => {console.log(`Chromium process closed with code: ${code}, signal: ${signal}`);});
chromiumProcess.on('exit', (code, signal) => {console.log(`Chromium process exited with code: ${code}, signal: ${signal}`);});
