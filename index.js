const utils = require('./utils');
const validatorsUtils = require('./utils/validators');

module.exports = {
  config: {
    asRouteService: true,
    routeRoot: '',
  },
  data: {
    dictionary: {
      Parent: { type: "ID", refer: "dictionary" },
      Name: { type: "String" },
      Description: { type: "String" },
      // can be string, public document files,
      Type: { type: "String", default: "String" },
      Value: { type: "Object" },
      Image: { type: "Object" },
      Labels: [
        {
          Locale: { type: "String", required: true },
          Label: { type: "String", required: true },
          Description: { type: "String" },
        },
      ],
      Index: { type: "Number", required: true },
      Info: { type: "Object" },
      Enabled: { type: "Boolean", required: true, default: true },

      // built-in dict will be read only for users
      BuiltIn: { type: "Boolean", required: true, default: true },
    },
    error_category: {
      Name: { type: "String", required: true, unique: true },
      Start: { type: "Number", required: true, unique: true },
      End: { type: "Number", required: true, unique: true },
    },
    error_code: {
      Category: { type: "ID", refer: "error_category" },
      Code: { type: "Number", required: true, unique: true },
      Description: { type: "String" },
      Message: { type: "String", required: true },
      Locale: { type: "String" },
    },
    menu: {
      Category: { type: "String", default: "DEFAULT" },
      Parent: { type: "ID", refer: "menu" },
      Name: { type: "String" },
      Description: { type: "String" },
      Route: { type: "String" },
      Index: { type: "Number", required: true },
      Label: { type: "String", default: "" },
      Icon: { type: "String", default: "" },
      Enabled: { type: "Boolean", default: true },
      Permission: { type: "Object", default: {} },
    },
    config: {
      Category: { type: "String", required: true, default: "DEFAULT" },
      Name: { type: "String", required: true },
      // // Type can be: String, Number, Boolean, Date, Rich, Object, Org, Dict
      // Type: { type: 'String', required: true, default: 'String' },
      // // when Type is Dict, we should know which dict we are referring to
      // Refer: { type: 'String', },
      Value: { type: "String", default: "" },
      Description: { type: "String" },
      Index: { type: "Number", required: true },
      // built-in config can be used by other modules but not the customer, but just use the utils of this module to manage them
      BuiltIn: { type: "Boolean", default: false },
      // the field definition for special headend render
      Field: { type: "Object" },
    },
    // log: {
    //     User: { type: 'String' },
    //     Url: { type: 'String', required: true },
    //     Database: { type: 'Array', default: [] },
    //     ClientIP: { type: 'String' },
    //     ClientOS: { type: 'String' },
    //     Browser: { type: 'String' },
    //     UserAgent: { type: 'String' },
    //     ResponseTime: { type: 'Number' },
    //     Module: { type: 'String' },
    //     ReturnStatus: { type: 'String' },
    //     ReturnCode: { type: 'String' },
    //     ReturnMsg: { type: 'String' },
    // }
  },
  i18n: {
    "en-us": {
      "module-title": "Core modules",
      "module-description": "All the built-in modules in the system.",
      "module-dict-title": "Dictionary Mangement",
      "module-dict-description": "Manage all the dictionary in the system.",
      "module-dict-export-title": "Export Dictionary",
      "module-dict-export-description": "Export all the dictionaries from the system.",
      "module-dict-import-title": "Import Dictionary",
      "module-dict-import-description": "Import dictionaries from provided data.",

      'module-error-title': 'Error code management',
      'module-error-description': 'Manage all the error code and messages in the system.',

      'module-menu-title': 'Menu management',
      'module-menu-description': 'Manage all the configurable menus in the system.',

      'module-system-title': 'System config management',
      'module-system-description': 'Manage all the system configuations.',
      'module-system-export-title': 'Export config',
      'module-system-export-description': 'Export all the system config from the system.',

      'module-log-title': 'System log management',
      'module-log-description': 'Manage all the system log in the system.',
    },
    "zh-cn": {
      "module-title": "????????????",
      "module-description": "?????????????????????????????????",
      "module-dict-title": "????????????",
      "module-dict-description": "?????????????????????????????????????????????",
      "module-dict-export-title": "??????????????????",
      "module-dict-export-description": "?????????????????????????????????????????????",
      "module-dict-import-title": "??????????????????",
      "module-dict-import-description": "??????????????????????????????????????????",

      'module-error-title': '??????????????????',
      'module-error-description': '??????????????????????????????????????????????????????',

      'module-menu-title': '????????????',
      'module-menu-description': '???????????????????????????????????????????????????',

      'module-system-title': '????????????',
      'module-system-description': '??????????????????????????????????????????',
      'module-system-export-title': '??????????????????',
      'module-system-export-description': '?????????????????????????????????',

      'module-log-title': '??????????????????',
      'module-log-description': '??????????????????????????????????????????',
    },
  },
  ...utils,
  validators: {
    ...validatorsUtils,
  }
};
