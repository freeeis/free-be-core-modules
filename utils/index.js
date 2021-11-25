const dictUtils = require('./dict');
const fieldsUtils = require('./fields');
const fileUtils = require('./file');
const menuUtils = require('./menu');
const systemUtils = require('./system');

module.exports = {
    ...dictUtils,
    ...fieldsUtils,
    ...fileUtils,
    ...menuUtils,
    ...systemUtils,
}