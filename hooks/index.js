const redis = require('redis');
const UAParser = require('ua-parser-js');

const writeLogMW = (mdl) => (req, res, next) => {

    // Database: { type: 'Array', default: [] },
    // ClientIP: { type: 'String' },
    // ReturnCode: { type: 'String' },

    if (res.locals.sysLog) {
        res.locals.sysLog.Module = mdl.name;

        if (res.locals.return) {
            res.locals.sysLog.ReturnStatus = res.locals.return.code;
            // res.locals.sysLog.ReturnCode = res.locals.return.returnData.msg.code;
            res.locals.sysLog.ReturnMsg = res.locals.return.returnData.msg.message || res.locals.return.returnData.msg;
        }

        if (res.locals.sysLog.StartTime)
            res.locals.sysLog.ResponseTime = new Date() - res.locals.sysLog.StartTime;

        if (req.user && req.user.id) res.locals.sysLog.User = req.user.id;

        // write to db
        if (res.app.models.log)
            res.app.models.log.create(res.locals.sysLog);
    }

    if (next) {
        return next();
    }
}

async function _process_response_error(res) {
    if (!res || !res.locals || !res.locals.err) return;

    const error = res.locals.err;
    if (error) {
        if (error.mdl && error.mdl.name) {
            // for customized error category
            const cat = await res.app.models.error_category.findOne({ Name: error.mdl.name || 'DEFAULT' });
            if (cat) {
                if (error.code > (cat.End - cat.Start)) {
                    res.app.logger.error(`Error code ${error.code} is too big for module ${error.mdl.name}`);
                }

                const eCode = await res.app.models.error_code.findOne(
                    {
                        Category: cat.id,
                        Code: cat.Start + error.code,
                        Locale: res.app.ctx.locale || res.app.config.defaultLocale
                    }
                );

                if (eCode) {
                    // format error msg
                    res.locals.err.msg = {
                        code: typeof error.msg === 'number' ? Number(error.msg) : cat.Start + error.code,
                        message: eCode.Message || res.locals.err.code
                    }
                    res.locals.err.code = 400;
                } else {
                    // format error msg
                    await res.app.models.error_code.create({
                        Category: cat.id,
                        Code: cat.Start + error.code,
                        Description: (typeof error.msg) === 'string' ? error.msg : '',
                        Locale: res.app.ctx.locale || res.app.config.defaultLocale,
                        Message: (typeof error.msg) === 'string' ? error.msg : (error.msg.message || error.msg.code || error.msg).toString,
                    }).catch((err) => {
                        res.app.logger.error(err);
                    })

                    res.locals.err.msg = {
                        code: typeof error.msg === 'number' ? Number(error.msg) : cat.Start + res.locals.err.code,
                        message: error.msg
                    }
                    res.locals.err.code = 400;
                }
            }
        }
    }
}

module.exports = {
    onAppReady: (app, mdl) => {
        // connecting to redis server
        let cache = redis.createClient(mdl.config.port || 6379, mdl.config.host || '127.0.0.1');

        cache.on('error', (err) => {
            app.logger.error(`ERROR in redis module: ${err}`);
        });

        if (cache) {
            app.redis = cache;

            // we support string, json object
            app.cache = {
                set: async (k, v, t) => {
                    if (!k) return;

                    return await new Promise((resolve, reject) => {
                        cache.set(k, JSON.stringify(v), (err) => {
                            if (err) {
                                reject(err);
                            } else {
                                if (t) {
                                    cache.expire(k, t / 1000, (error) => {
                                        if (error) {
                                            reject(error);
                                        } else {
                                            resolve();
                                        }
                                    });
                                } else {
                                    resolve();
                                }
                            }
                        });
                    });
                },
                get: async (k) => {
                    if (!k) return;

                    return await new Promise((resolve, reject) => {
                        cache.get(k, (err, data) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(JSON.parse(data));
                            }
                        });
                    });
                },
                del: async (k) => {
                    if (!k) return;

                    return await new Promise((resolve, reject) => {
                        cache.del(k, (err) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve();
                            }
                        });
                    });
                },
                keys: async (p = "*") => {
                    return await new Promise((resolve, reject) => {
                        cache.keys(p, (err, data) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(data);
                            }
                        });
                    });
                },
                save: () => {

                }
            }

            app.cache.put = app.cache.set;
        }
    },
    onLoadRouters: async (app, mdl) => {
        // init system config
        await mdl.setSystemConfig('哀悼日', '[]', null, '网站设置', '哀悼日列表设定', '', {
            "Index": 100,
            "Name": "Value",
            "Label": "哀悼日",
            "Type": "DynamicList",
            "Options": {
                "Columns": [
                    {
                        "Label": "年",
                        "Name": "Year",
                        "List": [
                            {
                                "Name": "Year",
                                "Type": "Year",
                                MinValue: new Date().getFullYear(),
                                MaxValue: new Date().getFullYear() + 10
                            }
                        ]
                    },
                    {
                        "Label": "日期",
                        "Name": "MourningDay",
                        "List": [
                            {
                                "Name": "MourningDay",
                                "Type": "TimeRange",
                            }
                        ]
                    }
                ],
            },
        });

    },
    beforeLastMiddleware: (app) => {
        app.get(`${app.config['baseUrl'] || ''}/mourning`,
            async (req, res, next) => {
                const systemConf = app.modules['system-config'];
                if (systemConf) {
                    const mourningList = await systemConf.get('哀悼日', '网站设置');
                    if (mourningList && mourningList.length) {
                        for (let i = 0; i < mourningList.length; i += 1) {
                            const item = mourningList[i];
                            const range = (item.MourningDay || '').split('~');
                            if (range && range.length === 2) {
                                const now = new Date();
                                const start = new Date(range[0]);
                                const end = new Date(range[1]);

                                if (item.Year) {
                                    start.setFullYear(item.Year);
                                    end.setFullYear(item.Year);
                                } else {
                                    const thisYear = now.getFullYear();
                                    start.setFullYear(thisYear);
                                    end.setFullYear(thisYear);
                                }

                                if (now >= start && now < end) {
                                    // res.locals.persData = res.locals.persData || {};
                                    // res.locals.persData.mourning = true;
                                    res.addData({mourning: true});

                                    return next();
                                }
                            }
                        }
                    }
                }

                return next();
            }
        );

        // app.use(async (req, res, next) => {
        //     // init system config
        //     const systemConf = app.modules['system-config'];
        //     if (systemConf) {
        //         const mourningList = await systemConf.get('哀悼日', '网站设置');
        //         if (mourningList && mourningList.length) {
        //             for (let i = 0; i < mourningList.length; i += 1) {
        //                 const item = mourningList[i];
        //                 const range = (item.MourningDay || '').split('~');
        //                 if (range && range.length === 2) {
        //                     const now = new Date();
        //                     const start = new Date(range[0]);
        //                     const end = new Date(range[1]);

        //                     if (item.Year) {
        //                         start.setFullYear(item.Year);
        //                         end.setFullYear(item.Year);
        //                     } else {
        //                         const thisYear = now.getFullYear();
        //                         start.setFullYear(thisYear);
        //                         end.setFullYear(thisYear);
        //                     }

        //                     if (now >= start && now < end) {
        //                         res.locals.persData = res.locals.persData || {};
        //                         res.locals.persData.mourning = true;

        //                         return next();
        //                     }
        //                 }
        //             }
        //         }
        //     }

        //     return next();
        // })

        app.use(async (req, res, next) => {
            await _process_response_error(res);
            return next();
        })
    },

    onModulesReady: (app) => {
        app.use(async function (req, res, next) {
            // add some function to the response
            res.endWithErr = async (code, msg, mdl) => {
                res.makeError(code, msg, mdl);
                await _process_response_error(res)

                res.status(res.locals.err.code).send({ msg: res.locals.err.msg });
            };

            return next();
        });
    },
    onRoutersReady: async (app) => {
        // add default error category
        if (await app.models.error_category.countDocuments({ Name: 'DEFAULT' }) <= 0) {
            await app.models.error_category.create({
                Name: 'DEFAULT',
                Start: 0,
                End: 10000,
            }).catch(err => {
                app.logger.error(err);
            });
        }

        // add error category for each module
        for (let i = 0; i < app.moduleNames.length; i += 1) {
            const m = app.moduleNames[i];

            // add to db
            if (await app.models.error_category.countDocuments({ Name: m }) > 0) {
                continue;
            }

            app.logger.debug(`Adding error category for ${m}`)

            const lastCat = await app.models.error_category.findOne({}).sort('-End');
            const start = lastCat ? lastCat.End + 1 : 10001;

            await app.models.error_category.create({
                Name: m,
                Start: start,
                End: start + 9999,
            }).catch(err => {
                app.logger.error(err);
            });
        }
    },

    // system logs
    onBegin: (app, mdl) => {
        app.use((req, res, next) => {
            const ignoreList = mdl.config.ignoreList || [];
            for (let i = 0; i < ignoreList.length; i += 1) {
                const il = ignoreList[i];

                if (typeof il === 'string' && il.toLowerCase() === req.originalUrl.toLowerCase()) return next();

                if (typeof il === 'object' && new RegExp(il).test(req.originalUrl)) return next();
            }

            res.app.config.beforeReturnError = res.app.config.beforeReturnError || [];
            res.app.config.beforeReturnError.push(writeLogMW(mdl));

            res.locals.sysLog = {
                UserAgent: req.headers['user-agent'],
                StartTime: new Date(),
                Url: req.originalUrl,
                Ip: req.headers['x-forwarded-for'] ||
                    (req.connection && req.connection.remoteAddress) ||
                    (req.socket && req.socket.remoteAddress) ||
                    (req.connection && req.connection.socket && req.connection.socket.remoteAddress) || ''
            };

            const parser = new UAParser();
            const uaInfo = parser.setUA(req.headers['user-agent']).getResult();

            if(uaInfo){
                res.locals.sysLog.Browser = uaInfo.browser && uaInfo.browser.name;
                res.locals.sysLog.ClientOS = uaInfo.os && uaInfo.os.name;
            }

            return next();
        });
    },
    afterLastMiddleware: (app, mdl = { name: 'unkown' }) => {
        app.use(writeLogMW(mdl));
    },
}