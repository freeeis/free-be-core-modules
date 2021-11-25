const express = require(require('path').resolve('./') + "/node_modules/express");
const router = express.Router();

router.get('/', (req, res, next) => {
    // res.locals = res.locals || {};

    // res.locals.fields = [
    //     'id',
    // ];

    return next();
},
    router.FindDocuments('log')
);

router.post('/', router.CreateDocument('log'));

router.put('/', router.UpdateDocument('log'));

router.delete('/', router.DeleteDocument('log'));

module.exports = router;
