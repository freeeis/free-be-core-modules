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
    router.FindAllDocuments('dictionary')
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

    // info object
    if (req.body.Info)
        req.body.Info = JSON.parse(req.body.Info);

    return next();
}, router.CreateDocument('dictionary'))

router.put('/', (req, res, next) => {
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
