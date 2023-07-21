const express = require(require('path').resolve('./') + "/node_modules/express");
const router = express.Router();

/**
 * get all the error code
 */
router.get('/',
    (req, res, next) => {
        const locale = req.body.locale || req.query.locale || 'zh-cn';
        res.locals.filter = {
            Locale: locale,
        };
        
        res.locals.fields = [
            'id',
            'Message',
            'Description',
            'Locale',
        ];

        return next();
    },
    router.FindDocuments('error_code')
)

router.put('/',
    (req, res, next) => {
        res.locals.fields = [
            'Message',
            'Description',
            'Locale',
        ]

        res.locals.body = {
            id: req.body.id,
            Message: req.body.Message,
            Description: req.body.Description,
        };

        const locale = req.body.locale || req.query.locale;
        if (locale) {
            res.locals.body.Locale = locale;
        }

        return next();
    },
    router.UpdateDocument('error_code')
);

module.exports = router;
