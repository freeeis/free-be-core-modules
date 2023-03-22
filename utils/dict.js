/**
 * 
 * @param {*} m Data model
 * @param {*} n Name of the dict
 * @param {*} p Parent dict of the current one
 * @param {*} v Value of the dict in diffent locales
 * @param {*} i Index of the current dict in its parrent
 * @param {*} b BuiltIn
 */
const createDict = async (app, m, n, p, v, l, b, index = 0) => {
    const labelList = [];
    const valueInfo = {};
    const data = {
        Name: n,
        Index: index,
        BuiltIn: b,
    };

    data.Value = v || n;

    Object.keys(l).forEach(k => {
        if (k === 'Value' || k === 'Index') {
            return;
        }
        labelList.push({
            Locale: k,
            Label: l[k].Label,
            Description: l[k].Description
        });

        if (l[k].Info) {
            Object.merge(valueInfo, l[k].Info);
        }
    })

    data.Labels = labelList;

    if (Object.keys(valueInfo).length > 0) data.Info = valueInfo;
    if (p) data.Parent = p.id;

    let parent = await m.create(data);

    const defaultLocale = app.config['defaultLocale'];
    const children = l[defaultLocale].Children;
    if (children && Array.isArray(children) && children.length > 0) {
        // create children dict values
        for (let i = 0; i < children.length; i += 1) {
            const newlabels = {};
            Object.keys(l).forEach(k => {
                newlabels[k] = l[k].Children[i];
            });

            await createDict(app, m, children[i].Name || n, parent, children[i].Value, newlabels, b, children[i].Index || i);
        }
    }
};

module.exports = {
    /**
     * Init a dictionary.
     * @param {*} n The code name of the dictionary.
     * @param {*} d The object which contains the values in different locales of the dictionary.
     * @param {*} b Built-in or not.
     */
    initDict: async function (n, d, b = true) {
        if (!n || !d || typeof n !== 'string' || typeof d !== 'object') {
            throw new Error('Init dict failed!');
        }

        const dictModel = this.models['dictionary'];
        if (!dictModel) throw new Error('Cannot find the dictionary model!');

        if (await dictModel.countDocuments({ Name: n }) > 0) {
            return;
        }

        const supportedLocales = this.app.config['locales'] || [];
        const defaultLocale = this.app.config['defaultLocale'];
        if (supportedLocales.indexOf(defaultLocale) <= 0) {
            supportedLocales.push(defaultLocale);
        }

        const providedLocales = {};
        supportedLocales.forEach(l => {
            if (d[l]) {
                providedLocales[l] = d[l];
            }
        })

        if (Object.keys(providedLocales).length <= 0) {
            // provided the object without locale info, treat it as the value for the default locale
            providedLocales[defaultLocale] = d;
        }

        await createDict(this.app, dictModel, n, undefined, '', providedLocales, b);
    },
    /**
     * Get the label for a given dictionary object according to the locale settings
     * 
     * @param {Object} d The given dictionary object
     * @param {String} locale The locale specified in the request
     */
    dictLabel: function (d, locale) {
        if (!d || !d.Labels || !Array.isArray(d.Labels)) return {};
        return d.Labels.find(v => v.Locale === (this.app.ctx.locale || locale || 'zh-cn'));
    },
    /**
     * Get the dictionary value according to the given key.
     * 
     * @param {String} n Name of the dict. Could use dot to seperate multiple levels
     * @param {Boolean} exact Only want to get the content of the specified dict but not it's children
     * @param {String} locale The locale specified in the request
     */
    dict: async function (n, exact = false, locale) {
        if (!n || typeof n !== 'string') {
            throw new Error('Get dict failed!');
        }

        const dictModel = this.models['dictionary'];
        if (!dictModel) throw new Error('Cannot find the dictionary model!');

        const pList = n.split('.');
        let parent;

        for (let i = 0; i < pList.length - 1; i += 1) {
            // const p = RegExp.quote(pList[i]);
            const p = new RegExp(`^${pList[i]}$`);

            parent = await dictModel.findOne({
                Parent: parent || {
                    $exists: false,
                    $eq: null
                },
                $or: [{
                    Name: p
                }, {
                    Value: p
                }, {
                    "Labels.Label": p
                }],
                Enabled: true
            })

            parent = parent ? parent.id : undefined;
        }

        // the last name in the chain
        const resultList = [];
        let dictList;
        // const lastName = RegExp.quote(pList[pList.length - 1]);
        const lastName = new RegExp(`^${pList[pList.length - 1]}$`);

        dictList = await dictModel.find({
            Parent: parent || {
                $exists: false,
                $eq: null
            },
            $or: [{
                Name: lastName
            }, {
                Value: lastName
            }, {
                "Labels.Label": lastName
            }],
            Enabled: true
        });

        if (dictList && dictList.length && !exact) {
            dictList = await dictModel.find({
                Parent: dictList[0].id,
                Enabled: true
            });
        }

        if (dictList)
            for (let i = 0; i < dictList.length; i += 1) {
                const dl = dictList[i];
                resultList[i] = {
                    Index: dl.Index,
                    Info: dl.Info,
                    Value: dl.Value,
                    Description: dl.Description,
                    Image: dl.Image
                }

                const localeLabel = dl.Labels.find(v => v.Locale === (this.app.ctx.locale || locale || 'zh-cn'));

                resultList[i].Label = (localeLabel && localeLabel.Label) ? localeLabel.Label : dl.Value
                resultList[i].Description = (localeLabel && localeLabel.Description) ? localeLabel.Description : ''
            }

        return resultList;
    },
    /**
     * Recursivly get the parent list for a given dictionary value in a root dictionary. 
     * Will return a list which contains all the parent and the given dict itself.
     * 
     * @param {String} n The name of the dictionary
     * @param {String} v The value of the given sub dictionary, for which we will get all it's parent
     */
    dictChain: async function (n, v) {
        if (!n || typeof n !== 'string' || typeof v !== 'string') {
            throw new Error('Get dict failed!');
        }

        const dictModel = this.models['dictionary'];
        if (!dictModel) throw new Error('Cannot find the dictionary model!');

        const dictParent = async (d) => {
            let ret = [d];
            if (!d) return [];

            if (d.Parent) {
                const parent = await dictModel.findOne({ id: d.Parent, Enabled: true });
                const plist = await dictParent(parent);
                ret = plist.concat(ret);
            }

            return ret;
        }

        return dictParent(await dictModel.findOne({
            Name: n,
            Value: v,
            Enabled: true
        }));
    }
}