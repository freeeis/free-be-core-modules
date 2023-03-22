module.exports = {
  generateQueryFilter: (flts, query) => {
    const filters = {};
    const kwFilter = [];
    (flts || []).forEach((ff) => {
      const fName = ff.Name.replace(/\./g, "_DOT_");
      if (query.kw) query.kw = query.kw.trim();
      if (
        ff &&
        ff.Name &&
        (typeof query[fName] !== "undefined" ||
          (query.kw && ff.Type === "String"))
      ) {
        // provided
        const kwf = {};
        let range, start, end;
        switch (ff.Type) {
          case 'Number':
          case 'NumberRange':
            range = query[fName].split('~');
            start = range[0] || -Infinity;
            end = range[1] || Infinity;
            filters[ff.Name] = { $gte: start, $lt: end };
            break;
          case 'Date':
          case 'Time':
          case "DateRange":
          case "TimeRange":
            range = query[fName].split("~");
            start = range[0] || "1000-01-01";
            end = range[1] || "3000-12-30";
            filters[ff.Name] = { $gte: new Date(start), $lt: new Date(end) };
            break;
          case "YearRange":
            range = query[fName].split("~");
            start = range[0] || "1000";
            end = range[1] || "3000";
            filters[ff.Name] = { $gte: start, $lt: end };
            break;
          case "String":
            // use key words
            if (ff.Info && ff.Info.Separate && query[ff.Name]) {
              // separate string filter field, as select!
              filters[ff.Name] = query[ff.Name];
            } else if (query.kw) {
              kwf[ff.Name] = RegExp.quote(query.kw, 'i');
              kwFilter.push(kwf);
            }
            break;
          default:
            if (["CreatedDate", "LastUpdateDate"].indexOf(ff.Name) >= 0) {
              range = query[fName].split("~");
              start = range[0] || "1000-01-01";
              end = range[1] || "3000-12-30";
              filters[ff.Name] = { $gte: new Date(start), $lt: new Date(end) };
            } else {
              filters[ff.Name] = query[fName];
            }

            break;
        }

        if (filters.Status === "") {
          filters.Status = {
            $exists: false,
            $eq: null,
          };
        }
      } else {
        for (let i = 0; i < Object.keys(query).length; i += 1) {
          const qk = Object.keys(query)[i];

          if (qk.startsWith(`${ff.Name}_DOT_`)) {
            filters[qk.replace(/_DOT_/g, ".")] = query[qk];
          }
        }
      }
    });

    // key words
    if (kwFilter.length) filters.$or = kwFilter;

    return filters;
  },
}