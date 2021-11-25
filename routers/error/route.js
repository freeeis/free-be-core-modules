const express = require(require('path').resolve('./') + "/node_modules/express");
const router = express.Router();

/**
 * get all the error code
 */
router.get('/',
    router.FindDocuments('error_code')
)

router.put('/',
    (req, res, next) => {
        res.locals.fields = [
            'Message',
            'Description'
        ]

        return next();
    },
    router.UpdateDocument('error_code')
);

module.exports = router;
