/**
 * Created by dingziran on 2016/2/3.
 */
var fs = require('fs');
var cheerio = require('cheerio');
var co = require('co');
var limiter = require('co-limiter');
var request = require('request');
var _ = require('lodash');
var FOLDER = "D:\\duowan\\";
var limit = limiter(5);
var limit_20 = limiter(20);
var start_timestamps = 0;
var current = 0;
var total = 0;
//var http = require('http');
//http.globalAgent.maxSockets=10;
//http.globalAgent = new http.Agent({
//    maxSockets:10
//});
run();
function run(){
    return co(function *() {
        yield step6(yield step5(yield step4(yield step3(yield step2(yield step1(360,600))))));
    }).catch(
        function onRejected(err){
            console.error(err.stack);
        }
    )
}
function step1(start,end){
    return co(function *() {
        console.log("step1");
        var urls=[];
        for(var i=start;i<end;i+=30){
            var url = `http://tu.duowan.com/tu?offset=${i}&order=created&math=${Math.random()}`;
            urls.push(url);
        }
        var bodyList = yield _.map(urls, function (url) {
            return new Promise(function (resolve, reject) {
                request(url, function (err, res, body) {
                    if(err) reject(err);
                    else{
                        resolve(JSON.parse(body).html);
                    }
                })
            })
        });
        return bodyList;
    })
}
function step2(bodyList){
    return co(function *() {
        console.log("step2",bodyList.length);
        var urlList=[];
        _.each(bodyList, function (body) {
            var $ = cheerio.load(body)
            $('li em a[href]').each(function () {
                var url = $(this).attr('href');
                urlList.push(url);
            })
        });
        return urlList;
    })
}
function step3(urlList){
    return co(function *() {
        console.log("step3",urlList.length);
        var index = 0;
        var galleryIds = yield _.map(urlList, function (url) {
            return limit_20(
                function *() {
                    return new Promise(function (resolve, reject) {
                        request(url, function (err,res,body) {
                            if(err) reject(err);
                            else{
                                resolve(body)
                            }
                        })
                    }).then(
                        function onFulfilled(result){
                            console.log(index);
                            index++;
                            var reg=/galleryId\s*=\s*"(\d+)"/;
                            var tmp = result.match(reg);
                            if(tmp && tmp.length>1){
                                return tmp[1];
                            }
                            else{
                                var err = new Error("gallayId not find");
                                err.statusCode = 400;
                                console.log(err.stack);
                                console.log(result);
                                return 111111;
                            }
                        }
                    )

                })
        })
        return galleryIds;
    })
}
function step4(galleryIds){
    return co(function *() {
        console.log("step4");
        var galleries =yield _.map(galleryIds, function (id) {
            return new Promise(function (resolve, reject) {
                var url=`http://tu.duowan.com/index.php?r=show/getByGallery/&gid=${id}&_=${Date.now()}`;
                request(url, function (err, res, body) {
                    if(err) reject(err);
                    else{
                        resolve(_.map(JSON.parse(body).picInfo, function (info) {
                            info.imageName = `${id}_${info.url.split('/')[info.url.split('/').length - 1]}`;
                            return info;
                        }));
                    }
                })
            })
        });
        return _.flatten(galleries);
    })
}
function step5(images){
    return co(function *() {
        console.log("step5");
        var files = fs.readdirSync(FOLDER);
        return _.differenceWith(images,files, function (image, file_name) {
            return image.imageName == file_name;
        })
    })
}
function step6(images){
    return co(function *() {
        console.log("step6");
        total = images.length;
        start_timestamps=Date.now();
        yield _.map(images,function (image) {
            return limit(downloadImage(image));
        });
    })
}
function* downloadImage(image) {
    return new Promise(function (resolve, reject) {
        //log.info("begin to crawl",imageUrl);
        //if(fs.existsSync(FOLDER + image.imageName)){
        //    resolve();
        //}
        //else {
        var inputStream = request.get(image.url);
        inputStream.on('error', function (err) {
            reject(err);
        });
        inputStream.on("end", function () {
            resolve();
            //log.info("finish to crawl",imageUrl);
        });
        var outputStream = fs.createWriteStream(FOLDER + image.imageName);
        inputStream.pipe(outputStream);
        //}
    }).then(
        function onFulfilled(){
            console.log(""+current+"/"+total,
                "\trate:",((Date.now()-start_timestamps)/current).toFixed(1),"ms",
                "\tleft time:",((Date.now()-start_timestamps)/current*(total-current)/1000/60).toFixed(2),"minutes");
            current++;
        }
    );
}