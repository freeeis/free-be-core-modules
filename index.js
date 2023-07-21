const utils = require('./utils');
const validatorsUtils = require('./utils/validators');
const hooks = require('./hooks');

module.exports = {
  config: {
    asRouteService: true,
    routeRoot: '',
    redisPort: 6379,
    redisHost: '127.0.0.1',

    ignoreList: [],
    frequencyControls: [
        // {
        //     url: /\/api\/(xxx|yyy)(\/?.*)*/,          // url pattern or string
        //     ignoreGuest: false,     // will not check guest when set to true
        //     ignoreUser: false,      // will not check login users when set to true
        //     shared: false,          // will check global times no matter who made such access logs
        //     levels: [               // current lovel stored in a data collection
        //         {
        //             duration: 10000,  // how long time
        //             return: '',       // 200, 401, 400, '' (any), 'fail' (!==200)
        //             times: 10,       // with how many access logs
        //             lock: 10000,        // will log how long time (ms)
        //             // data: (req, res) => { // object or string, to return as the data when locking
        //             //     return {
        //             //         total: Math.ceil(Math.random() * 99999),
        //             //         docs: [{
        //             //         },{}],
        //             //         page: 1,
        //             //         limit: 100,
        //             //     };
        //             // },
        //             message: () => `您的操作过快，已被锁定！`,    // and with this error message, could be function or string
        //             lockMessage: (level) => `您的操作过快，将被锁定${level.lock / 1000}秒！`,
        //             lockedMessage: (level, leftTime) => `您已被锁定，请等待${leftTime / 1000}秒！`,
        //         },
        //         {
        //             duration: 60000,
        //             times: 20,
        //             lock: 60000,
        //             message: (level) => `您的操作过快，将被锁定${level.lock / 1000}秒！`,    // and with this error message, could be function or string
        //             lockMessage: (level) => `您的操作过快，将被锁定${level.lock / 1000}秒！`,
        //             lockedMessage: (level, leftTime) => `您已被锁定，请等待${leftTime / 1000}秒！`,
        //         },
        //         {
        //             duration: 120000,
        //             times: 30,
        //             lock: 3600000,
        //             message: (level) => `您的操作过快，将被锁定${level.lock / 1000}秒！`,    // and with this error message, could be function or string
        //             lockMessage: (level) => `您的操作过快，将被锁定${level.lock / 1000}秒！`,
        //             lockedMessage: (level, leftTime) => `您已被锁定，请等待${leftTime / 1000}秒！`,
        //         },
        //     ],
        // },
        // {
        //     url: /\/api\/login(\/?.*)*/,
        //     levels: [
        //         {
        //             duration: 10000,
        //             // return: 'fail',
        //             times: 10,
        //             lock: 10000,
        //         },
        //         {
        //             duration: 30000,
        //             // return: 'fail',
        //             times: 15,
        //             lock: 30000,
        //         },
        //         {
        //             duration: 600000,
        //             // return: 'fail',
        //             times: 30,
        //             lock: 1800000,
        //             message: (level) => `您的操作过快，将被锁定${level.lock / 1000}秒！`,    // and with this error message, could be function or string
        //         }
        //     ],
        // },
        // {
        //     url: '',                // no url means global access frequency control for a user or ip
        //     ignoreGuest: false,
        //     ignoreUser: false,
        //     levels: [
        //         {
        //             duration: 10000,
        //             times: 5,
        //             lock: 5,
        //             message: () => `bye！`,
        //         },
        //         {
        //             duration: 3000,
        //             times: 10,
        //             lock: 60000,
        //             message: () => `bye 2！`,
        //         },
        //     ],
        // },
    ],
    accessRatios: [
        // {
        //     name: 'AU',
        //     groups: 'User,Ip',
        //     sort: true, // true, false/0, 1, -1, 100, -100, '-1', '1'
        //     limit: 100,
        //     sum: false,
        //     unique: false, // count groups with true, count for each group with false
        // },
        // {
        //     name: 'PV',
        //     // sort: true, // true, false/0, 1, -1, 100, -100, '-1', '1'
        //     // limit: 100,
        //     sum: false,
        //     groups: [
        //         {
        //             name: 'policy details',
        //             url: /\/api\/portal\/policy\/[a-z0-9A-Z].*/,
        //             removeQueries: true,
        //         },
        //         {
        //             name: 'standard details',
        //             url: /\/api\/portal\/standard\/[a-z0-9A-Z].*/,
        //             removeQueries: true,
        //         },
        //     ],
        // },
        // {
        //     name: 'UV',
        //     // sort: true, // true, false/0, 1, -1, 100, -100, '-1', '1'
        //     // limit: 100,
        //     sum: false,
        //     groups: [
        //         {
        //             name: 'policy details',
        //             url: /\/api\/portal\/policy\/[a-z0-9A-Z].*/,
        //             removeQueries: true,
        //             groups: 'User,Ip',
        //         },
        //         {
        //             name: 'standard details',
        //             url: /\/api\/portal\/standard\/[a-z0-9A-Z].*/,
        //             removeQueries: true,
        //             groups: 'User,Ip',
        //         },
        //     ],
        // },
    ],
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
      Category: { type: 'ID', refer: 'error_category' },
      Code: { type: 'Number', required: true },
      Description: { type: 'String' },
      Message: { type: 'String', required: true },
      Locale: { type: 'String' },

      __Indexes: [{
          def: {
              Category: 1,
              Code: 1,
              Locale: 1,
          },
          set: {
              unique: true,
          },
      }]
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
      
      Value: { type: "String", default: "" },
      Description: { type: "String" },
      Index: { type: "Number", required: true },
      // built-in config can be used by other modules but not the customer, but just use the utils of this module to manage them
      BuiltIn: { type: "Boolean", default: false },
      // the field definition for special headend render
      Field: { type: "Object" },

      // Type can be: String, Number, Boolean, Date, Rich, Object, Org, Dict or any customized data type
      Type: { type: 'String', required: true, default: 'String' },
      // when Type is Dict, we should know which dict we are referring to
      Refer: { type: 'String', },

    },
    log: {
        User: { type: 'String' },
        Url: { type: 'String', required: true },
        Database: { type: 'Array', default: [] },
        ClientIP: { type: 'String' },
        ClientOS: { type: 'String' },
        Browser: { type: 'String' },
        UserAgent: { type: 'String' },
        ResponseTime: { type: 'Number' },
        Module: { type: 'String' },
        ReturnStatus: { type: 'String' },
        ReturnCode: { type: 'String' },
        ReturnMsg: { type: 'String' },

        StartTime: { type: 'Date' },
        Ip: { type: 'String' },

        lock: {type: 'Object' },
    },
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
      "module-title": "核心模块",
      "module-description": "系统内置核心功能模块。",
      "module-dict-title": "字典管理",
      "module-dict-description": "统一管理系统中所有的字典数据。",
      "module-dict-export-title": "导出数据字典",
      "module-dict-export-description": "导出系统中所有的数据字典数据。",
      "module-dict-import-title": "导入数据字典",
      "module-dict-import-description": "根据提供数据导入为数据字典。",

      'module-error-title': '错误代码管理',
      'module-error-description': '统一管理系统中的错误代码和报错信息。',

      'module-menu-title': '菜单管理',
      'module-menu-description': '统一管理系统中所有可配置的菜单项。',

      'module-system-title': '系统配置',
      'module-system-description': '统一管理系统中所有配置信息。',
      'module-system-export-title': '导出系统配置',
      'module-system-export-description': '导出所有的系统配置信息',

      'module-log-title': '访问日志管理',
      'module-log-description': '统一管理系统中所有访问日志。',
    },
  },
  ...utils,
  validators: {
    ...validatorsUtils,
  },
  hooks,
};
