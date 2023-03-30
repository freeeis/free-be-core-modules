const path = require('path');
const express = require(path.resolve('./') + "/node_modules/express");
const router = express.Router();

router.get('/',
    (req, res, next) => {
        res.locals.filter = {
            BuiltIn: false
        };
        res.locals.fields = [
            'Category',
            'Type',
            'Value',
            'Name',
            'Description',
            'Index',
            'id',
            'Field'
        ];

        res.locals.options.sort = 'id';

        return next();
    },
    router.FindAllDocuments('config', false,
        (req, res) => {
            if (res.locals.data && res.locals.data.total) {
                // parse object values (as we always store the value as string)

                for (let i = 0; i < res.locals.data.docs.length; i += 1) {
                    const doc = res.locals.data.docs[i];

                    if (doc.Field && doc.Field.Type && doc.Value) {
                        switch (doc.Field.Type) {
                            case 'Check':
                            case 'Boolean':
                                doc.Value = (doc.Value || '').toLowerCase() === 'true';
                                break;
                            case 'Number':
                                doc.Value = Number(doc.Value);
                                break;
                            case 'SelectionChain':
                            case 'Permission':
                            case 'MixedTable':
                            case 'File':
                            case 'FileList':
                            case 'Image':
                            case 'ImageList':
                            case 'FixedList':
                            case 'DynamicList':
                                try {
                                    doc.Value = JSON.parse(doc.Value);
                                } catch (e) {
                                    res.app.logger.error(e);
                                }

                                break;
                            default:
                                break;
                        }
                    }
                }
            }
        }
    ));

// router.post('/', router.CreateDocument('config'));

router.put('/',
    (req, res, next) => {
        res.locals.filter = {
            BuiltIn: false,
            id: req.body.id
        };

        res.locals.fields = [
            'Value',
        ];

        if (req.body.Value && typeof req.body.Value === 'object') {
            req.body.Value = JSON.stringify(req.body.Value);
        }

        return next();
    },
    router.UpdateDocument('config'));

// router.delete('/', router.DeleteDocument('config'));

// file uploads
router.post(
    '/upload',
    (req, res, next) => {
        router.mdl.fileUploadWithoutLimit(req, res, next);
    },
    // upload,
    (req, res, next) => {
        if (!req.file) {
            res.makeError(400, '无法识别上传的文件！');
            if (next)
                return next('route');
        }

        res.addData({
            id: path.join(req.file.myDir, req.file.filename)
        })

        return next();
    }
);

module.exports = router;
