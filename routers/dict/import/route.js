const express = require(require('path').resolve('./') + "/node_modules/express");
const router = express.Router();

/**
 * get all the dicts
 */
router.post('/',
    async (req, res, next) => {
        if (!req.body.Name || !req.body.Content) {
            await res.endWithErr(400);
            return;
        }

        const locale = req.body.locale || 'zh-cn';

        const dBody = {};
        dBody[locale] = {
            Label: req.body.Name,
            Value: '',
            Name: req.body.Name,
            Children: []
        };

        let rows = req.body.Content.split(/\n/);

        switch (req.body.Type) {
            case 'rows':
                for (let i = 0; i < rows.length; i += 1) {
                    const r = rows[i];

                    if(!r) continue;

                    dBody[locale].Children.push({
                        Index: i + 1,
                        Label: r.trim(),
                        Value: `${i + 1}`
                    });
                }

                res.app.logger.debug(`adding dictionary, ${JSON.stringify(dBody)}`)

                await router.mdl.initDict(req.body.Name, dBody);

                break;
            default:
                await res.endWithErr(400);
                return;
        }

        return next();
    },
)

/**
 * Import for dictionary translations.
 * 
 * @param {c} contents for the translations with lines of format
 *            Name\Label in Chinese\tlocale\tTranslation, exg.
 *            "xxx类型\t类型一\ten-us\tType One"
 */
router.post('/trans', 
  async (req, res, next) => {
    if (!req.body.c) return next();
    const lines = req.body.c.split('\n').filter(ll => !!ll);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i].split('\t');
      if (line.length !== 4) continue;

      const theDict = await res.app.models.dictionary.findOne({
        Name: line[0],
        "Labels.Label": line[1],
      });

      if (!theDict) continue;
      
      theDict.Labels = theDict.Labels || [];
      const cnLabel = theDict.Labels.find((lb) => lb.Locale === 'zh-cn');
      if (cnLabel && cnLabel.Label === line[1]) {
        const theLabel = theDict.Labels.find((lb) => lb.Locale === line[2]);

        if (theLabel) {
          theLabel.Label = line[3];
        } else {
          theDict.Labels.push({
            Label: line[3],
            Locale: line[2],
            Description: '',
          });
        }

        await theDict.save();
      }
    }
    
    return next();
  }
);

module.exports = router;
