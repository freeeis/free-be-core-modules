const express = require(require('path').resolve('./') + "/node_modules/express");
const router = express.Router();

router.get('/', (req, res, next) => {
    res.locals = res.locals || {};

    res.locals.fields = [
        'id',
        'Label',
        'Index',
        'Enabled',
        'Permission',
        'Category',
        'Icon',
        'Route',
        'Description',
    ];

    res.locals.filter = {
        Parent: req.query.Parent || {
            $exists: false,
            $eq: null
        }
    }
    
    res.locals.options.sort = 'id';

    return next();
},
    router.FindAllDocuments('menu')
);

router.post('/',
    (req, res, next) => {
        const passport = res.app.modules.passport;
        if (passport && req.body.Permission) {
            passport.utils.clearPermission(req.body.Permission);
        }
        return next();
    },
    router.CreateDocument('menu')
);

router.put('/',
    (req, res, next) => {
        const passport = res.app.modules.passport;
        if (passport && req.body.Permission) {
            passport.utils.clearPermission(req.body.Permission);
        }
        return next();
    },
    router.UpdateDocument('menu')
);

router.delete('/', async (req, res, next) => {
    // every category should have at least one menu.
    const theMenu = await res.app.models['menu'].findOne({ id: req.body.id });
    if (!theMenu) {
        await res.endWithErr(400);
        return;
    } else {
        const count = await res.app.models['menu'].countDocuments({ Category: theMenu.Category });
        if (!count || count < 2) {
            await res.endWithErr(400);
            return;
        }
    }

    return next();
}, router.DeleteDocument('menu'));

// get menus from a specified category
router.get('/menus',
    (req, res, next) => {
        res.locals.filter.Category = req.query.category || null;
        res.locals.filter.Enabled = true;

        // res.locals.options.limit = 100000;

        // res.locals.fields=[
        //     'Parent',
        //     'Name',
        //     'Description',
        //     'Route',
        //     'Index',
        //     'Label',
        //     'Icon'
        // ];

        return next();
    },
    router.FindAllDocuments('menu', false, async (req, res) => {
        // if we have passport enabled, check permission
        const passport = res.app.modules.passport;
        let menus = [];

        if (passport) {
            const filterMenu = async (m) => {
                let hasPerm = true;
                m.Permission = m.Permission || {};
                const permPath = passport.utils.getPermissionPathList(m.Permission);
                for (let i = 0; i < permPath.length; i += 1) {
                    const p = permPath[i];

                    if (!await passport.utils.verify_api_permission(res.app, passport, req.user, `${res.app.config['baseUrl']}${p}`)) {
                        hasPerm = false;
                        break;
                    }
                }

                // return hasPerm ? m : undefined;
                // if (!hasPerm) m = null;
                if (hasPerm) menus.push(m);
            }

            if (res.locals.data && res.locals.data.total) {
                for (let i = 0; i < res.locals.data.docs.length; i += 1) {
                    await filterMenu(res.locals.data.docs[i])
                }
            }
        } else {
            menus = res.locals.data.docs;
        }

        // make the nested menus
        const nestedMenus = (ms, p) => {
            const levelMenus = [];
            p = (p && p.toString()) || '';

            for (let i = 0; i < ms.length; i += 1) {
                const m = ms[i];
                const parent = (m.Parent && m.Parent.toString()) || '';

                if (p === parent) {
                    const sub = nestedMenus(ms, m.id).sort(
                        (a, b) => (a ? a.Index : 0) - (b ? b.Index : 0)
                    );

                    // remove empty parent menus
                    if ((sub && sub.length > 0) || m.Route) {
                        // delete unused fields
                        levelMenus.push({
                            Route: m.Route,
                            Label: m.Label,
                            Index: m.Index,
                            Icon: m.Icon,
                            Sub: sub,
                        });
                    }
                }
            }

            return levelMenus;
        }

        // let menus = res.locals.data.docs;
        menus = nestedMenus(menus).sort(
            (a, b) => (a ? a.Index : 0) - (b ? b.Index : 0)
        );

        res.addData({ menus }, true);
    })
);

module.exports = router;
