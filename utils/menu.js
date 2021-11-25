module.exports = {
    ensureMenu: async function(c) {
        if(!c) return;

        const count = await this.models['menu'].countDocuments({Category: c});
        if(count) return;

        // create first demo menu
        await this.models['menu'].create({
            Category: c,
            Index: count,
        });
    },
}