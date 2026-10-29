'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const packageJson = require('../package.json');
const { menuPaths } = require('../src/menuVisibility');

test('Settings exposes every configurable viewer menu path', () => {
  const configuration = Array.isArray(packageJson.contributes.configuration)
    ? packageJson.contributes.configuration[0]
    : packageJson.contributes.configuration;
  const setting = configuration.properties['vivi.explorerContextMenu'];
  assert.deepEqual(Object.keys(setting.properties), menuPaths);
  assert.deepEqual(Object.keys(setting.default), menuPaths);
  assert.ok(menuPaths.every(path => setting.default[path] === true));
});
