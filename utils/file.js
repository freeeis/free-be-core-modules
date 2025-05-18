const fs = require('fs');
const multer = require('multer');
const fse = require('fs-extra');
const path = require('path');
const mime = import('mime');
const thumb = require('node-thumbnail').thumb;
const parse = require('csv-parse');
const AdmZip = require('adm-zip');
const iconv = require('iconv-lite');
const child_process = require('child_process');
const { v4:uuid } = require('uuid');
const xlsx = require('xlsx');

// config
const config = Object.merge(
  {},
  require(`${path.resolve('./')}/config/config.default`),
  require(`${path.resolve('./')}/config/config.${process.env.NODE_ENV}`)
);

let csv = {};

/**
 * 解析csv文件 返回一个对象的数组
 * promise async/await
 * @param file csv文件
 * @constructor
 */
csv.Parse = function (file) {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(file, { encoding: 'binary' });
    let data = '';
    let result = [];
    let column;
    stream.on('error', (err) => {
      reject(err);
    });
    stream.on('data', (chunk) => {
      data += chunk;
    });
    stream.on('end', () => {
      const buf = Buffer.from(data, 'binary');
      const str = iconv.decode(buf, 'GBK'); // node不支持GBK
      let strArr = str.split('\r\n');
      // 组装对象
      for (let i = 0; i < strArr.length - 1; i++) {
        if (i === 0) { // csv第一列作为对象的key
          column = strArr[i].split(',');
          continue;
        }
        let objTmp = {};
        for (let j = 0; j < column.length; j++) {
          let arrTmp = strArr[i].split(',');
          objTmp[column[j]] = arrTmp[j];

        }
        result.push(objTmp);
      }
      resolve(result);
    });
  });
};

// /** the unzip package will cause error "ReferenceError" with new version node
//  * 解压zip文件 返回全路径+文件名
//  * promise async/await
//  * @param file zip文件
//  * @param path zip文件解压的路径
//  * @constructor
//  */
// csv.Unzip = function (file, path) {
//   return new Promise((resolve, reject) => {
//     try {
//       let tmp = fs.createReadStream(file).pipe(unzip.Extract({ path: path }));
//       tmp.on('close', function () {
//         let filePath = tmp._opts.path + '/' + fs.readdirSync(tmp._opts.path)[0];
//         resolve(filePath);
//       });
//     } catch (e) {
//       reject(e);
//     }

//   });
// };

const SupportedImageTypes = ['.png', '.jpg', '.jpeg', '.bmp', '.gif'];
const SupportedZipTypes = ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.tgz'];
const SupportedDocsTypes = ['.doc', '.docx', '.xls', '.xlsx', '.pdf'];
// const SupportedVideoTypes = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv'];

/**
 * 文件不存在返回false 若存在返回res设置对象
 */
const fileDownload = function (path, fileName) {
  let stats;
  try {
    stats = fs.statSync(path);
  } catch (e) {
    return false;
  }
  return {
    'Content-Type': 'application/octet-stream', //告诉浏览器这是一个二进制文件
    'Content-Disposition': 'attachment; filename=' + fileName, //告诉浏览器这是一个需要下载的文件
    'Content-Length': stats.size  //文件大小
  };
};

const mp4Streaming = function (file, req, res) {
  const stats = fs.statSync(file);
  if (stats) {
    var range = req.headers.range;
    if (!range) {
      // 416 Wrong range
      // return res.sendStatus(416);
      res.writeHead(200, { 'Content-Length': stats.size, 'Content-Type': 'video/mp4' });
      fs.createReadStream(file).pipe(res);
    } else {
      var positions = range.replace(/bytes=/, "").split("-");
      var start = parseInt(positions[0], 10);
      var total = stats.size;
      var end = positions[1] ? parseInt(positions[1], 10) : total - 1;
      var chunksize = (end - start) + 1;

      res.writeHead(206, {
        "Content-Range": "bytes " + start + "-" + end + "/" + total,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": "video/mp4"
      });

      var stream = fs.createReadStream(file, { start: start, end: end })
        .on("open", function () {
          stream.pipe(res);
        }).on("error", function (err) {
          res.end(err);
        });
    }
  }
};

/**
 * 删除文件 fileArr必须为数组
 */
const fileDeleteSync = function (path, name) {
  let dir = (path[path.length - 1] === '/') ? path : path + '/';
  let fileName = name;
  if (!fileName) {
    fileName = '';
    dir = path;
  }
  if (Array.isArray(fileName)) {
    fileName.forEach((item) => {
      if (typeof item === 'object') {
        fs.unlinkSync(dir + item.Name);
      } else {
        fs.unlinkSync(dir + item);
      }
    });
  } else {
    fs.unlinkSync(dir + fileName);
  }
};

/**
 * 解析zip(csv)文件 返回数组
 */
let unzipFile = function (file) {
  return new Promise((resolve) => {
    let zip = new AdmZip(file);
    let zipEntries = zip.getEntries();
    // let resultArr = [];
    // let first = true;
    // for (let i = 0; i < zipEntries.length; i++) {
    //   let item = zipEntries[i];
    //   if (item.isDirectory === false) {
    //     let tmpStr = iconv.decode(item.getData(), 'gbk');
    //     let tmpArr = await parseCSVSync(tmpStr);
    //     if (tmpArr && false === first) {
    //       tmpArr.splice(0, 1);
    //     }
    //     resultArr = resultArr.concat(tmpArr);
    //     first = false;
    //   }
    // }

    function parseCSVSync (str) {
      return new Promise((resolve) => {
        parse(str, function (err, data) {
          return resolve(data);
        });
      });
    }

    return Promise.all(zipEntries.map((item, idx) => {
      return new Promise((resv) => {
        if (item.isDirectory === false) {
          let tmpStr = iconv.decode(item.getData(), 'gbk');
          parseCSVSync(tmpStr).then((tmpArr) => {
            if (tmpArr && idx > 0) {
              tmpArr.splice(0, 1);
            }

            resv(tmpArr);
          });
        }
      })
    })).then((...tmpArr) => {
      let resultArr = [];
      
      for (let i = 0; i < tmpArr.length; i += 1) {
        resultArr = resultArr.concat(tmpArr[i]);
      }

      return resolve(resultArr);
    })
  });
};

const staticRoot = config.staticFolders[0] || path.join(__dirname, '../public/uploads');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (req.uploadDestination) {
      cb(null, req.uploadDestination);
      return;
    }

    let ext = path.extname(file.originalname);
    ext = ext.length > 1 ? ext : '.' + mime.getExtension(file.mimetype);
    ext = ext.toLowerCase();
    let dir = '';
    const yyymm = (new Date()).toISOString().slice(0, 7).replace(/-/g, '');
    file.myDir = yyymm;

    if (SupportedZipTypes.indexOf(ext) >= 0) {
      dir = path.join(staticRoot, 'zip/' + yyymm);
    }
    else if (SupportedDocsTypes.indexOf(ext) >= 0) {
      dir = path.join(staticRoot, 'docs/' + yyymm);
    }
    else if (SupportedImageTypes.indexOf(ext) >= 0) {
      dir = path.join(staticRoot, 'image/' + yyymm);
    }
    else {
      dir = path.join(staticRoot, 'misc/' + yyymm);
    }

    //文件夹不存在则创建文件夹
    if (false === fs.existsSync(dir)) {
      fse.mkdirpSync(dir);
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    let ext = path.extname(file.originalname);
    ext = ext.length > 1 ? ext : '.' + mime.getExtension(file.mimetype);
    require('crypto').pseudoRandomBytes(16, function (err, raw) {
      cb(null, (err ? undefined : raw.toString('hex')) + ext);
    });
  }
});

/**
 * 上传到指定的文件目录
 */
const storageToDir = multer.diskStorage({
  destination: function (req, _, cb) {
    // let ext = path.extname(file.originalname);
    // ext = ext.length>1 ? ext : '.' + mime.getExtension(file.mimetype);
    // ext = ext.toLowerCase();

    // TODO: 期望可以通过可变的传入文件路径
    //指定dir的文件夹子的名字   dir:  public/uploads/docs
    // let fileDirPath = req.body.fileDirPath;
    // let fileDirPath = res.locals.data.fileDirPath;
    // let dir = path.join(__dirname, '../'+fileDirPath );

    // uploadToDir.fileStorePath = 'uploads/officialdoc';
    let dir = path.join(__dirname, '../public/' + uploadToDir.fileStorePath);

    //文件夹不存在则创建文件夹
    if (false === fs.existsSync(dir)) {
      fse.mkdirpSync(dir);
    }
    cb(null, dir);
  },
  filename: function (_, file, cb) {
    let ext = path.extname(file.originalname);
    ext = ext.length > 1 ? ext : '.' + mime.getExtension(file.mimetype);
    require('crypto').pseudoRandomBytes(16, function (err, raw) {
      cb(null, (err ? undefined : raw.toString('hex')) + ext);
    });
  }
});

/**
 * 制作略缩图 中间件
 */
const makeThumb = (width = 160) => {
  return async function (req, res, next) {
    if (!req.file) {
      res.makeError(400, '无法识别上传的文件！');
      if (next)
        return next('route');
    }

    let ext = path.extname(req.file.originalname);
    ext = ext.length > 1 ? ext : '.' + mime.getExtension(req.file.mimetype);
    ext = ext.toLowerCase();

    fse.ensureDirSync(path.join(staticRoot, 'thumb/', req.file.myDir + '/'));

    if (SupportedImageTypes.indexOf(ext) >= 0) {
      // 图片，生成缩略图。
      try {
        await thumb({
          source: path.join(staticRoot, 'image/', req.file.myDir + '/', req.file.filename),
          destination: path.join(staticRoot, 'thumb/', req.file.myDir + '/'),
          prefix: '',
          suffix: '',
          digest: false,
          hashingType: 'sha1',    // 'sha1', 'md5', 'sha256', 'sha512'
          width: width,
          concurrency: 1,         // number of CPUs
          quiet: false,           // if set to 'true', console.log status messages will be supressed
          overwrite: false,
          skip: true,             // Skip generation of existing thumbnails
          basename: undefined,    // basename of the thumbnail. If unset, the name of the source file is used as basename.
          ignore: true,           // Ignore unsupported files in "dest"
        },
          (file, err) => {
            if (err) {
              res.makeError(500, '生成缩略图失败！' + err);
              if (next)
                return next('route');
            }
          });
      } catch (ex) {
        res.makeError(500, '生成缩略图失败！' + ex);
        if (next)
          return next('route');
      }
    }

    res.locals.data = { Id: req.file.myDir + '/' + req.file.filename };

    if (next)
      return next();
  };
};

/**
 * 上传文件 中间件
 */
const upload = (req, res, next) => {
  const limit = (res.app && res.app.config) ? (res.app.config.uploadFileSizeLimit || 10 * 1024 * 1024) : 10 * 1024 * 1024
  multer({
    storage: storage,
    limits: {
      fileSize: limit,
      fieldSize: limit
    }
  }).single('file')(req, res, next);
}

/**
 * 上传多文件 中间件
 */
const uploadFiles = (req, res, next) => {
  const limit = (res.app && res.app.config) ? (res.app.config.uploadFileSizeLimit || 10 * 1024 * 1024) : 10 * 1024 * 1024
  multer({
    storage: storage,
    limits: {
      fileSize: limit,
      fieldSize: limit
    }
  }).array('files', res.locals.__max_files_count)(req, res, next);
}

const uploadNoLimit = (req, res, next) => {
  // console.log(res.app.config)
  const limit = (res.app && res.app.config) ? (res.app.config.adminUploadFileSizeLimit || 1000 * 1024 * 1024) : 1000 * 1024 * 1024
  multer({
    storage: storage,
    limits: {
      fileSize: limit,
      fieldSize: limit
    }
  }).single('file')(req, res, next)
}

/**
 * 上传文件到 `指定目录` 中间件
 */
const uploadToDir = (req, res, next) => {
  const limit = (res.app && res.app.config) ? (res.app.config.uploadFileSizeLimit || 10 * 1024 * 1024) : 10 * 1024 * 1024
  multer({
    storage: storageToDir,
    limits: {
      fileSize: limit,
      fieldSize: limit
    }
  }).single('file')(req, res, next);
}

const unZip = function () {
  return async (req, res, next) => {
    let file = req.file;
    if (file === undefined) {
      res.makeError(400, '文件不存在！');
      if (next)
        return next('route');
    }

    let ext = path.extname(req.file.filename);
    ext = ext.length > 1 ? ext : '.' + mime.getExtension(req.file.mimetype);
    ext = ext.toLowerCase();

    if (ext !== '.zip') {
      if (next)
        return next();
    }

    let parseData;
    try {
      parseData = await unzipFile(file.path);
    } catch (e) {
      res.makeError(400, 'zip解析失败，请上传包含.csv文件的压缩包！');
      if (next)
        return next('route');
    }
    res.locals.parseDataArr = parseData;

    if (next)
      return next();
  };
};

/**
 * Add file to zip
 * 
 * @param {String} f The file name
 * @param {String} content File content
 * @param {String} comment Comments
 */
const zip = function (f, content, comment = '') {
  return async (req, res, next) => {
    if (f) {
      res.locals.zipObject = res.locals.zipObject || new AdmZip();
      if (content) {
        res.locals.zipObject.addFile(iconv.encode(f, 'gbk'), Buffer.alloc(content.length, content), comment);
      } else if (typeof f === 'object' && f.path) {
        const bufData = fs.readFileSync(f.path);
        let fname = f.name || f.path;
        fname = fname.split('/').pop();
        if (bufData)
          res.locals.zipObject.addFile(iconv.encode(fname, 'gbk'), bufData, comment);
      } else if (fs.existsSync(f)) {
        res.locals.zipObject.addLocalFile(f, comment);
      }
    } else {
      if (res.locals.zipObject) {
        const entries = res.locals.zipObject.getEntries();

        if (entries && entries.length <= 0) {
          const content = "没有找到可下载的数据！";
          res.locals.zipObject.addFile(iconv.encode("注意.txt", 'gbk'), Buffer.alloc(content.length * 3, content));
        }

        if (entries && entries.length > 0) {
          // const buffer = res.locals.zipObject.toBuffer();
          // res.addData({ zip: buffer }, false);

          const fName = `${res.app.config.tmpFolder || '/tmp'}/${res.locals.zipFileName || Date.now()}.zip`;
          res.locals.zipObject.writeZip(fName);
          res.status(200);
          res.download(fName);

          return;
        }
      }

      // res.makeError(400, '没有可下载的数据！');
    }

    if (next)
      return next();
  };
}

/**
 * doc,docx转jpg 中间件
 * input 路径+文件名
 * outPath 路径
 * options 图片配置
 *        options = {
 *           width: 640,
 *           height: 480,
 *           quality: 90,
 *           background: '#ffffff',
 *        }
 */
const doc2Jpg = function () {
  return async (req, res, next) => {
    let options = res.locals.options || {};
    let hash = uuid();
    let ext = path.extname(req.file.filename);
    ext = ext.length > 1 ? ext : '.' + mime.getExtension(req.file.mimetype);
    ext = ext.toLowerCase();

    let tempPDF;
    if (ext === '.pdf') {
      tempPDF = path.join(req.file.destination + '/', req.file.filename);
    } else if (ext === '.doc' || ext === '.docx') {
      tempPDF = path.join(req.file.destination + '/', hash + '.pdf');
      try {
        await doc2PDF(req.file.destination + '/' + req.file.filename, tempPDF);
      } catch (err) {
        // 查看生成的文件是否已经生成，如果没有则报错
        if (!fs.existsSync(tempPDF)) {
          res.makeError(500, '文件转换失败！');
          return next('route');
        }
      }
    } else {
      res.makeError(400, '请上传doc/docx/pdf格式的文件！');
      return next('route');
    }
    try {
      let outPath = path.join(staticRoot, 'image/' + req.file.myDir);
      req.file.originalFile = req.file.filename;
      req.file.filename = await PDF2Jpg(tempPDF, outPath, options);
      req.file.destinationImage = outPath;
    } catch (err) {
      res.makeError(500, '生成图片失败！');
      return next('route');
    }
    return next();
  };
};

/**
 * doc,docx转PDF
 * input 路径+文件名
 * output 路径+文件名(自定义)
 */
const doc2PDF = function (input, output) {
  return new Promise((resolve, reject) => {
    child_process.execFile('unoconv', ['-o', output, input], function (err, stdout, stderr) { // TODO 删除的参数 '-e', 'PageRange=1-2',
      if (err || stderr) {
        return reject(err);
      }
      return resolve(output);
    });
  });
};

const PDF2Jpg = async function (input, outPath, options) {
  return new Promise((resolve, reject) => {
    let hash = uuid();
    let output = outPath + '/' + hash + '/' + hash + '.jpg';
    let quality = options.quality || 80; // 品质
    let density = options.density || 120; // 像素密度
    let convertOtherArgs = [input, output];
    // if (options.width > 0 && options.height > 0) {
    //     convertOtherArgs.splice(0, 0, '-resize', options.width + 'x' + options.height);
    // }

    convertOtherArgs.splice(0, 0, '-quality', quality);
    convertOtherArgs.splice(0, 0, '-density', density);

    if (!fs.existsSync(outPath + '/' + hash)) {
      fs.mkdirSync(outPath + '/' + hash);
    }
    child_process.execFile('convert', convertOtherArgs, async function (err, stdout, stderr) {
      if (err || stderr) {
        return reject(err);
      }
      let images = await readFilesAndMoveSync(outPath + '/' + hash);
      fs.unlinkSync(input);
      return resolve(images);
    });
  });

  function readFilesAndMoveSync (pathName) {
    return new Promise((resolve, reject) => {
      let imageArr = [];
      fs.readdir(pathName, function (err, files) {
        if (err) return reject(err);
        for (let i = 0; i < files.length; i++) {
          fse.moveSync((pathName + '/' + files[i]), (pathName + '/../' + files[i]));
          imageArr.push(files[i]);
        }
        fse.removeSync(pathName);
        return resolve(imageArr);
      });
    });
  }
};

/**
 * 将csv中解析出的数据按指定的方式转换成db中的document。
 *
 * @param data csv中解析出来的原始数据
 * @param def 定义的解析方式
 * @returns {Array} 返回documents
 * @constructor
 */
const CSVDataToDocuments = async function (data, def) {
  async function process_rows (rows, title, keyIndex) {
    if (rows.length > 0) {
      let d = {};

      const keys = Object.keys(def);
      for (let i = 0; i < keys.length; i += 1) {
        const k = keys[i];
        const v = def[k];

        if (k === 'Key') continue;

        if (typeof v === 'function') {
          // 处理方法
          d[k] = await v(rows, title, keyIndex);
        }
        else if (v === '') {
          // 未定义，跳过
        }
        else if (typeof v === 'string') {
          // 字符串，直接拷贝一个原始数据
          if (title.indexOf(v) >= 0)
            d[k] = rows[0][title.indexOf(v)];
        }
      }

      return d;
    }
  }

  if (!data || data.length < 2) return [];

  let result = [];

  // 列标题
  const title = data[0];

  for (let i = 0; i < title.length; i += 1) {
    title[i] = title[i].trim();
  }

  // 获取唯一标识所在的列序号
  let keyIndex = -1;

  if (def.Key !== null) {
    const keys = def.Key.split('||');
    if (keys && keys.length > 0) {
      for (let i = 0; i < keys.length; i += 1) {
        let index = title.indexOf(keys[i]);

        if (index >= 0) {
          keyIndex = index;
          break;
        }
      }
    }
  }

  // 获取可以组成document的行
  let extId = undefined;
  let rows = [];
  for (let i = 1; i < data.length; i++) {
    let row = data[i];

    if (!row && i < (data.length - 1)) continue;

    if (row) {
      const pattern = ',',
        re = RegExp.quote(pattern, 'g');

      if (row.toString().replace(re, '').trim() === '')
        continue;
    }

    // 如果出现新的ExtOrderId，则把前面缓存的处理，否则继续添加到缓存
    if (def.Key === null || extId !== (row ? row[keyIndex] : undefined) || i >= (data.length - 1)) {
      const d = await process_rows(rows, title, keyIndex);
      if (d) result.push(d);

      if (row) {
        extId = row[keyIndex];
        rows = [row];
      }
    }
    else {
      rows.push(row);
    }
  }

  // 处理最后缓存的行，需要封装
  const d = await process_rows(rows, title, keyIndex);
  if (d) result.push(d);

  return result;
};

const ExcelParse = function () {
  return async (req, res, next) => {
    let file = req.file;
    if (file === undefined) {
      res.makeError(400, '文件不存在！');
      if (next)
        return next('route');
    }

    if (res.locals.parseDataArr && res.locals.parseDataArr.length > 0) {
      if (next)
        return next();
    }

    let ext = path.extname(req.file.filename);
    ext = ext.length > 1 ? ext : '.' + mime.getExtension(req.file.mimetype);
    ext = ext.toLowerCase();

    if (!(ext === '.xls' || ext === '.xlsx')) {
      res.makeError(400, '请上传 .xls 或 .xlsx文件！');
      if (next)
        return next('route');
    }

    // let parseData = xlsx.parse(file.path);
    let parseData = xlsx.readFile(file.path);
    let resultArr = [];
    let first = true;

    if (Array.isArray(parseData)) {
      for (let i = 0; i < parseData.length; i++) {
        let tmpArr = parseData[i].data;
        if (tmpArr.length > 1) {
          if (false === first) {
            tmpArr.splice(0, 1);
          }
          resultArr = resultArr.concat(tmpArr);
        }
        first = false;
      }
    } else {
      for (let i = 0; i < parseData.SheetNames.length; i += 1) {
        const sName = parseData.SheetNames[i];

        if (parseData.Sheets && parseData.Sheets[sName]) {
          const sheet = parseData.Sheets[sName];
          resultArr.push(xlsx.utils.sheet_to_json(sheet));
        }
      }
    }

    res.locals.parseDataArr = resultArr;

    if (next)
      return next();
  };

};

const exportCSV = function (fname = 'export', timestamp = true, express = false) {
  return async (req, res, next) => {
    if (!res.locals.data) return next();

    // write csv
    // let jdata = JSON.stringify(res.locals.data);
    // jdata = JSON.parse(jdata);

    const csvContent = xlsx.utils.sheet_to_csv(xlsx.utils.json_to_sheet(res.locals.data));
    // var stream = xlsx.stream.to_csv(xlsx.utils.json_to_sheet(jdata));
    // var stream = xlsx.stream.to_csv(csvContent);

    // res.writeHead(200, {
    //     'Content-Type': 'application/octet-stream', //告诉浏览器这是一个二进制文件
    //     'Content-Disposition': 'attachment; filename=test.csv', //告诉浏览器这是一个需要下载的文件
    //     });

    // stream.pipe(res);

    if (express) {
      zip(fname, `\ufeff${csvContent}`)(req, res);
      zip()(req, res);
    } else {
      res.addData({
        content: `\ufeff${csvContent}`,
        name: `${timestamp ? Date.now() + '_' : ''}${fname}`
      });

      if (next)
        return next();

      // const fName = `/tmp/${timestamp ? Date.now() + '_' : ''}${fname}`;
      // fs.writeFileSync(fName, `\ufeff${csvContent}`)

      // res.locals.NONEXT = true;
      // res.status(200);
      // res.download(fName);
    }
  }
};

module.exports = {
  csv,
  fileDld: fileDownload,
  fileDel: fileDeleteSync,
  zip,
  unzipFile: unzipFile,
  doc2PDF: doc2PDF,
  PDF2Jpg: PDF2Jpg,
  doc2Jpg: doc2Jpg,           // middleware
  fileUpload: upload,         // middleware
  uploadFiles,
  fileUploadWithoutLimit: uploadNoLimit,
  fileUploadTo: uploadToDir,  // middleware
  imageThumb: makeThumb,      // middleware
  unZip: unZip,               // middleware
  ExcelParse: ExcelParse,     // middleware
  CSVDataToDocuments: CSVDataToDocuments,
  mp4Streaming,
  exportCSV
}