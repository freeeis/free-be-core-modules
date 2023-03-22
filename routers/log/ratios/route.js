const express = require(require('path').resolve('./') + "/node_modules/express");
const router = express.Router();

router.post('/', (req, res, next) => {
    const ratios = router.mdl.config.accessRatios || [];

    const ret = {};

    for (let i = 0; i < ratios.length; i += 1) {
        const ratio = ratios[i];
        
        ret[ratio.name] = '';
    }

    res.adddata(ret);

    return next();
});

module.exports = router;
