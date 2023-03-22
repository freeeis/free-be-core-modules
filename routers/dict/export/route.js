const express = require(require('path').resolve('./') + "/node_modules/express");
const router = express.Router();

/**
 * get all the dicts
 */
router.get('/',
    router.FindAllDocuments('dictionary')
)

/**
 * Export dictionary for translating
 * 
 */
router.get('/trans', 
    async (req, res, next) => {
        const allDicts = await res.app.models.dictionary.find({});

        const locales = {};
        for (let i = 0; i < allDicts.length; i += 1) {
            const dict = allDicts[i];
            dict.Labels = dict.Labels || [];
            const cnLabel = dict.Labels.find((lb) => lb.Locale === 'zh-cn');

            for (let j = 0; j < dict.Labels.length; j += 1) {
                const label = dict.Labels[j];
                if (label && label.Locale) {
                    locales[label.Locale] = locales[label.Locale] || [];

                    locales[label.Locale].push({
                        Name: dict.Name,
                        CN: (cnLabel && cnLabel.Label) || '',
                        Locale: label.Locale,
                        Trans: label.Label || '',
                    });
                }
            }
        }

        // for missing translations
        const cnDicts = locales['zh-cn'] || [];
        const localeKeys = Object.keys(locales);
        for (let i = 0; i < localeKeys.length; i += 1) {
            const locale = localeKeys[i];
            if (locale === 'zh-cn') continue;

            for (let j = 0; j < cnDicts.length; j += 1) {
                const cnDict = cnDicts[j];

                if (locales[locale].findIndex(lc => (lc.Name === cnDict.Name) && (lc.CN === cnDict.CN)) < 0) {
                    locales[locale].push({
                        Name: cnDict.Name,
                        CN: cnDict.CN,
                        Locale: locale,
                        Trans: '',
                    });
                }
            }
        }

        // combine
        const ret = {
            c: [],
        };

        for (let i = 0; i < localeKeys.length; i += 1) {
            const locale = localeKeys[i];
            if (locale === 'zh-cn' && !req.body.z) continue;

            ret.c.push(locales[locale].map(lc => `${lc.Name}\t${lc.CN}\t${lc.Locale}\t${lc.Trans}`).join('\n'));
        }

        ret.c = ret.c.join('\n');

        res.addData(ret);

        return next();
    }
);

module.exports = router;
