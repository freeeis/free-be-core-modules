const express = require(require('path').resolve('./') + "/node_modules/express");
const router = express.Router();

/**
 * get all the dicts
 */
router.get('/',
    router.FindAllDocuments('config')
)

module.exports = router;
