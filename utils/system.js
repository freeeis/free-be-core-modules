module.exports = {
    setSystemConfig: async function (n, v, i, c = 'DEFAULT', d = '', t, f) {
        if (!n || typeof n !== 'string') {
            throw new Error(`Set config ${n} to ${v} failed!`);
        }

        const configModel = this.models['config'];
        if (!configModel) throw new Error('Cannot find the config model!');

        if (await configModel.countDocuments({
            Category: c,
            Name: n,
        }) > 0) {
            const theConfig = await configModel.findOne({
                Category: c,
                Name: n,
            });

            if(theConfig){
                // update
                theConfig.Description = d;

                if (f && f.Index) theConfig.Index = Number(f.Index);
                if (typeof i === 'number') theConfig.Index = i;

                if (t) theConfig.Type = t;
                if (f) theConfig.Field = f;

                await theConfig.save();
            }
            
            return;
        }

        const data = {
            Category: c,
            Name: n,
            Value: v,
            Description: d,
        };

        if (typeof i === 'number') data.Index = i;
        else {
            const count = await configModel.countDocuments({});
            data.Index = count;
        }

        if (t) data.Type = t;
        if (f) data.Field = f;

        await configModel.create(data);
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