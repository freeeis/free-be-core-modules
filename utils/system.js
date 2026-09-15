module.exports = {
    setSystemConfig: async function (n, v, i, c = 'DEFAULT', d = '', t, f) {
        if (!n || typeof n !== 'string') {
            throw new Error(`Set config ${n} to ${v} failed!`);
        }

        const configModel = this.models['config'];
        if (!configModel) throw new Error('Cannot find the config model!');

        const filter = {
            Category: c,
            Name: n,
        };

        const set = { };
        if (d) {
            set.Description = d;
        }
        
        if (v !== undefined && v !== '') set.Value = v;

        if (f && f.Index !== undefined) {
            const fieldIndex = Number(f.Index);
            if (Number.isFinite(fieldIndex)) set.Index = fieldIndex;
        }
        if (typeof i === 'number' && Number.isFinite(i)) set.Index = i;

        if (t) set.Type = t;
        if (f) set.Field = f;

        const setOnInsert = {
            ...filter,
            Value: v,
            Description: d,
        };

        if (set.Index === undefined) {
            const count = await configModel.countDocuments({});
            setOnInsert.Index = count;
        } else {
            setOnInsert.Index = set.Index;
        }

        if (t) setOnInsert.Type = t;
        if (f) setOnInsert.Field = f;

        Object.keys(set).forEach((key) => {
            delete setOnInsert[key];
        });

        await configModel.findOneAndUpdate(
            filter,
            { $set: set, $setOnInsert: setOnInsert },
            { upsert: true, new: true },
        );
    },
    getSystemConfig: async function (n, c = 'DEFAULT') {
        if (!n || typeof n !== 'string') {
            throw new Error(`Get config ${n} failed!`);
        }

        const configModel = this.models['config'];
        if (!configModel) throw new Error('Cannot find the config model!');

        const config = await configModel.findOne({
            Category: c,
            Name: n
        });

        if (config) {
            if (config.Field && config.Field.Type) {
                switch (config.Field.Type) {
                    case 'Check':
                    case 'Boolean':
                        return (config.Value || '').toLowerCase() === 'true';
                    case 'Number':
                        return Number(config.Value);
                    case 'SelectionChain':
                    case 'Permission':
                    case 'MixedTable':
                    case 'File':
                    case 'FileList':
                    case 'Image':
                    case 'ImageList':
                    case 'FixedList':
                    case 'DynamicList':
                        if(typeof config.Value === 'object') return config.Value;
                        
                        return config.Value ? JSON.parse(config.Value) : {};
                    default:
                        return config.Value;
                }
            } else {
                return config.Value
            }
        }
        else return undefined;
    }
}