const path = require('path');
const express = require(path.resolve('./') + "/node_modules/express");
const router = express.Router();

// file upload
router.post('/upload',
    (req, res, next) => router.mdl.fileUpload(req, res, next),
    (req, res, next) => router.mdl.imageThumb(res.app.config.ImageThumbWidth || 300)(req, res, next),
    (req, res, next) => {
        if (!req.file) {
            res.makeError(400, 'Cannot recognize the uploaded file!');
            if (next) {
                return next('route');
            }
        }

        res.addData({
            id: path.join(req.file.myDir, req.file.filename)
        })

        return next();
    }
);

// multiple files upload without thumbnail
router.post('/uploads',
    (req, res, next) => router.mdl.uploadFiles(req, res, next),
    (req, res, next) => {
        if (!req.files || req.files.length === 0) {
            res.makeError(400, 'Cannot recognize the uploaded file!');
            if (next) {
                return next('route');
            }
        }

        res.addData(
            req.files.map((file) => {
                return {
                    id: path.join(file.myDir, file.filename)
                }
            }),
        );

        return next();
    }
);

module.exports = router;