const express = require(require('path').resolve('./') + "/node_modules/express");
const router = express.Router();

/**
 * get all the dicts
 */
router.post('/',
    async (req, res, next) => {
        if (!req.body.Name || !req.body.Content) {
            await res.endWithErr(400);
            return;
        }

        const locale = req.body.locale || 'zh-cn';

        const dBody = {};
        dBody[locale] = {
            Label: req.body.Name,
            Value: '',
            Name: req.body.Name,
            Children: []
        };

        let rows = req.body.Content.split(/\n/);

        switch (req.body.Type) {
            case 'rows':
                for (let i = 0; i < rows.length; i += 1) {
                    const r = rows[i];

                    if(!r) continue;

                    dBody[locale].Children.push({
                        Index: i + 1,
                        Label: r.trim(),
                        Value: `${i + 1}`
                    });
                }

                res.app.logger.debug(`adding dictionary, ${JSON.stringify(dBody)}`)

                await router.mdl.initDict(req.body.Name, dBody);

                break;
            default:
                await res.endWithErr(400);
                return;
        }

        return next();
    },
)

module.exports = router;
