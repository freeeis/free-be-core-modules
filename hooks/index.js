const redis = require('redis');
const UAParser = require('ua-parser-js');

const writeLogMW = (mdl) => async (req, res, next) => {
    if (res.logWritten) {
        if (next && !res._headerSent) {
            return next();
        }

        return;
    }

    res.logWritten = true;

    if (res.locals.sysLog) {
        // check access frequency
        await checkFrequency(mdl, req, res);

        res.locals.sysLog.Module = mdl.name;

        if (res.locals.return) {
            res.locals.sysLog.ReturnStatus = res.locals.return.code;
            // res.locals.sysLog.ReturnCode = res.locals.return.returnData.msg.code;
            res.locals.sysLog.ReturnMsg = res.locals.return.returnData.msg.message || res.locals.return.returnData.msg;
            res.locals.sysLog.ReturnMsg = res.locals.sysLog.ReturnMsg.message || res.locals.sysLog.ReturnMsg;

            if (typeof res.locals.sysLog.ReturnMsg !== 'string') {
                res.locals.sysLog.ReturnMsg = `${res.locals.sysLog.ReturnMsg}`;
            }
        } else if (res.statusCode) {
            res.locals.sysLog.ReturnStatus = res.statusCode;
        }

        if (res.locals.sysLog.StartTime)
            res.locals.sysLog.ResponseTime = new Date() - res.locals.sysLog.StartTime;

        if (req.user && req.user.id) res.locals.sysLog.User = req.user.id;

        // write to db
        if (res.app.models.log)
            res.app.models.log.create(res.locals.sysLog);
    }

    if (next && !res._headerSent) {
        return next();
    } else {
        return;
    }
}

async function _process_response_error(req, res) {
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
                        Locale: req.body.locale || req.query.locale || res.app.ctx.locale || res.app.config.defaultLocale
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
                    // crete error msg for each supported locales
                    const locales = res.app.config.locales || [res.app.config.defaultLocale];
                    for (let i = 0; i < locales.length; i += 1) {
                        const locale = locales[i];
              
                        await res.app.models.error_code.create({
                            Category: cat.id,
                            Code: cat.Start + error.code,
                            Description: (typeof error.msg) === 'string' ? error.msg : '',
                            Locale: locale,
                            Message: (typeof error.msg) === 'string' ? error.msg : (error.msg.message || error.msg.code || error.msg).toString,
                        }).catch((err) => {
                            res.app.logger.error(err);
                        })
                    }

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

// const logDataSchema = {
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

//     StartTime: { type: 'Date' },
//     Ip: { type: 'String' },

//     lock: {type: 'Object' },
// };

const checkFrequency = async (mdl, req, res, before) => {
    if (res.locals.blocked || !res.locals.sysLog) return false;

    const ctls = mdl.config.frequencyControls || [];
    for(let i = 0; i < ctls.length; i += 1) {
        const ctl = ctls[i];
        let urlMmatch = false;

        if (!ctl.url) {
            urlMmatch = true;
        } else if (typeof ctl.url === 'object' && new RegExp(ctl.url).test(req.originalUrl)) {
            urlMmatch = true;
        }

        if (urlMmatch) {            
            const userCondition = ctl.shared ? {} : (req.user ? (ctl.ignoreUser ? {} : {User: req.user.id}) : (ctl.ignoreGuest ? {} : {Ip: res.locals.sysLog.Ip || ''}));
            const urlCondition = ctl.url ? {Url: ctl.url} : {};
            const lockRecord =  await mdl.app.models.log.findOne({...urlCondition, ...userCondition, lock: {$exists: true}}, {lock: 1, CreatedDate: 1}).sort({CreatedDate: -1}).lean()|| {};
            const lock = (lockRecord && lockRecord.lock) || {};

            let lockLevel = typeof lock.level === 'number' ? lock.level : -1;
            lockLevel = lockLevel < -1 ? -1 : lockLevel;
            
            const lockTime = lock.lock || 0;
            const lockedTime = (lockRecord.CreatedDate ? Date.now() - lockRecord.CreatedDate : 0);

            if (lockedTime < lockTime) {
                // continue to lock
                res.locals.blocked = true;
                res.app.logger.error(`still in lock (level ${lockLevel})... ${req.originalUrl}`);
                const cLevel = (ctl.levels || [])[lockLevel] || {};

                if (cLevel.data) {
                    res.endWithData(typeof cLevel.data === 'function' ? cLevel.data(req, res) : cLevel.data);
                } else {
                    const msg = cLevel.lockedMessage || cLevel.message || cLevel.lockMessage;
                    res.endWithErr(400, msg ? ((typeof msg === 'function') ? msg(cLevel, lockTime - lockedTime) : msg) : `您的操作过于频繁，请稍后再试！`, mdl);    
                }
                return false;
            }

            for (let j = (lockLevel >= ctl.levels.length - 1) ? (ctl.levels.length - 1) : (lockLevel + 1); j < ctl.levels.length; j += 1) {
                const lv = ctl.levels[j];

                if (lv.return && before) {
                    continue;
                }

                if (!lv.return && !before) {
                    continue;
                }

                if (lv.return === 'fail' && lv.return === 200) {
                    continue;
                } else if (lv.return && lv.return !== 'fail' && lv.return !== res.locals.return.code) {
                    continue;
                }

                // check times
                const existsRecords = await mdl.app.models.log.countDocuments({CreatedDate: {$gt: new Date(new Date() - lv.duration)}, ...urlCondition, ...userCondition});
                if (existsRecords >= lv.times) {
                    // lock and increase lock level
                    res.locals.sysLog.lock = lv;
                    res.locals.sysLog.lock.level = j;

                    res.locals.blocked = true;
                    res.app.logger.error(`lock triggerred (level ${j})... ${req.originalUrl}`);

                    if (lv.data) {
                        res.endWithData(typeof lv.data === 'function' ? lv.data(req, res) : lv.data);
                    } else {
                        const msg = lv.lockMessage || lv.message;
                        res.endWithErr(400, msg ? ((typeof msg === 'function') ? msg(lv) : msg) : `您的操作过于频繁，已被锁定！`, mdl);    
                    }
                    
                    return false;
                } else if (lockedTime > lv.duration && lockLevel > -1) {
                    // unlock and decrease lock level
                    res.app.logger.error(`unlock (level ${lockLevel})... ${req.originalUrl}, `);
                    res.locals.sysLog.lock = ctl.levels[lockLevel - 1] || {
                        locked: false,
                    };
                    res.locals.sysLog.lock.level = lockLevel - 1;

                    break;
                } else {
                    break;
                }
            }
        }
    }
};

module.exports = {
    onAppReady: async (app, mdl) => {
        // connecting to redis server
        let cache = redis.createClient({ socket : { host: mdl.config.redisHost || '127.0.0.1', port: mdl.config.redisPort || 6379 } });

        app.redis = cache;

        cache.on('error', (err) => {
            app.logger.error(`ERROR in redis module: ${err}`);
        });
        cache.on("ready", async () => {
            // we support string, json object
            app.cache = {
                set: async (k, v, t) => {
                    if (!k) return;

                    return await new Promise((resolve, reject) => {
                        cache.set(k, JSON.stringify(v)).then(() => {
                            if (t) {
                                cache.expire(k, t / 1000).then(() => {
                                    resolve();
                                }).catch((err) => {
                                    reject(err);
                                });
                            } else {
                                resolve();
                            }
                        }).catch((err) => {
                            reject(err);
                        });
                    });
                },
                get: async (k) => {
                    if (!k) return;

                    return await new Promise((resolve, reject) => {
                        cache.get(k).then((data) => {
                            let obj = {};
                            try {
                                obj = JSON.parse(data);
                            } catch(_){
                                //
                            }
                            resolve(obj);
                        }).catch((err) => {
                            reject(err);
                        });
                    });
                },
                del: async (k) => {
                    if (!k) return;

                    return await new Promise((resolve, reject) => {
                        cache.del(k).then(() => {
                            resolve();
                        }).catch((err) => {
                            reject(err);
                        });
                    });
                },
                keys: async (p = "*") => {
                    return await new Promise((resolve, reject) => {
                        cache.keys(p).then((data) => {
                            resolve(data);
                        }).catch((err) => {
                            reject(err);
                        });
                    });
                },
                save: () => {

                }
            }

            app.cache.put = app.cache.set;

            app.logger.debug('redis is ready!');
        });

        cache.connect();

        // // create log model
        // app.db.initModuleSchema(app, mdl, {
        //     log: logDataSchema,
        // });
        // app.db.initModuleModel(app, mdl, {
        //     log: '',
        // });
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
    beforeLastMiddleware: (app, mdl) => {
        app.get(`${app.config['baseUrl'] || ''}/mourning`,
            async (req, res, next) => {
                const mourningList = await mdl.getSystemConfig('哀悼日', '网站设置');
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

                return next();
            }
        );

        app.use(async (req, res, next) => {
            await _process_response_error(req, res);
            return next();
        })
    },

    onModulesReady: (app) => {
        app.use(async function (req, res, next) {
            // add some function to the response
            res.endWithErr = async (code, msg, mdl) => {
                res.makeError(code, msg, mdl);
                await _process_response_error(req, res)

                if (!res._headerSent) {
                    res.status(res.locals.err.code).send({ msg: res.locals.err.msg });
                }
            };

            return next();
        });
    },
    onRoutersReady: async (app) => {
        // unlock api
        app.get('/api/log/unlock', async (req, res, next) => {
            const { user, ip } = req.query;
            const userCondition = user ? {User: user} : {};
            const ipCondition = ip ? {Ip: ip} : {};
            const condition = { ...userCondition, ...ipCondition, lock: {$exists: true}, 'lock.lock': {$exists: true, $ne: 0} };

            res.app.logger.error(`unlock ${user || ''}, ${ip || ''}`);
            const updateRes = await app.models.log.updateMany(condition, {$set: {'lock.lock': 0}});
            
            res.addData({
                unlocked: updateRes.nModified || 0,
            }, true);

            return next();
        });

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
        app.use(async (req, res, next) => {
            const ignoreList = mdl.config.ignoreList || [];
            for (let i = 0; i < ignoreList.length; i += 1) {
                const il = ignoreList[i];

                if (typeof il === 'string' && il.toLowerCase() === req.originalUrl.toLowerCase()) return next();

                if (typeof il === 'object' && new RegExp(il).test(req.originalUrl)) return next();
            }

            res.beforeReturnErrorMws = res.beforeReturnErrorMws || [];
            res.beforeReturnErrorMws.push(writeLogMW(mdl));

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

            // check access frequency
            await checkFrequency(mdl, req, res, true);
            
            return next();
        });
    },
    afterLastMiddleware: (app, mdl = { name: 'unkown' }) => {
        app.use(writeLogMW(mdl));
    },
}