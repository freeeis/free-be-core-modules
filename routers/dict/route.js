const express = require(require('path').resolve('./') + "/node_modules/express");
const router = express.Router();

/**
 * get all the dicts
 */
router.get('/',
    (req, res, next) => {
        res.locals.filter = {
            Parent: req.query.Parent || {
                $exists: false,
                $eq: null
            },
        };

        res.locals.options = { lean: true };

        return next();
    },
    router.FindAllDocuments('dictionary', false, (req, res) => {
        // get label from the labels list
        if (res.locals.data && res.locals.data.total) {
            res.locals.data.docs.forEach(doc => {
                if (doc.Labels && doc.Labels.length) {
                    const l = res.app.ctx.locale || res.app.config['defaultLocale'] || 'zh-cn';
                    const lb = doc.Labels.find(ll => ll.Locale === l);
                    if (lb) {
                        doc.Label = lb.Label;
                        doc.Description = lb.Description;
                    }

                    delete doc.Labels;
                }
            })
        }
    })
)

router.post('/', async (req, res, next) => {
    // customer added is not built-in
    req.body.BuiltIn = false;

    if (req.body.Parent) {
        const parentD = await res.app.models.dictionary.findOne({ id: req.body.Parent });
        if (!parentD) {
            return next('route');
        }

        if (parentD.Name) {
            req.body.Name = req.body.Name || parentD.Name || '';
        }
    }

    // set labels
    const l = res.app.ctx.locale || res.app.config['defaultLocale'] || 'zh-cn';
    req.body.Labels = [{
        Locale: l,
        Label: req.body.Label || '',
        Description: req.body.Description || ''
    }]

    // info object
    if (req.body.Info)
        req.body.Info = JSON.parse(req.body.Info);

    return next();
}, router.CreateDocument('dictionary'))

router.put('/', (req, res, next) => {
    // set labels
    const l = res.app.ctx.locale || res.app.config['defaultLocale'] || 'zh-cn';
    req.body.Labels = [{
        Locale: l,
        Label: req.body.Label || '',
        Description: req.body.Description || ''
    }];

    // info object
    if (req.body.Info)
        req.body.Info = JSON.parse(req.body.Info);

    // only can update few fields
    res.locals.fields = [
        "Name",
        'Value',
        'Labels',
        'Info',
        'Index',
        'Image',
        'Description',
        'Enabled'
    ]

    return next();
}, router.UpdateDocument('dictionary'))

router.delete('/',
    (req, res, next) => {
        // only can delete customized dict
        res.locals.filter.BuiltIn = false;
        res.locals.filter.id = req.body.id;

        return next();
    },
    router.DeleteDocument('dictionary')
);

module.exports = router;
