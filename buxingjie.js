var request = require('request');
var cheerio = require('cheerio');
var bunyan = require('bunyan');
var co = require('co');
var limiter = require('co-limiter');
var fs = require('fs');
var log = bunyan.createLogger({name: 'buxingjie'});
var gif_filename = "history_gif.txt";
var png_filename = "history_png.txt";
var un_filename = "history_unknown.txt";
var _ = require('lodash');
var FOLDER = "D:\\downloads\\20160913\\";
var images = {};
var posts = {};
var post_queue = [];
var img_queue = [];

var data = fs.readFileSync(gif_filename,'utf8').split("\n");
log.info(data.length+" gifs loaded from file");
_.each(data,(imageUrl)=>{
    images[imageUrl]=1;
});
var gifStream = fs.createWriteStream(gif_filename, {'flags': 'a'});
// data=fs.readFileSync(png_filename,'utf8').split("\n");
// log.info(data.length+" pngs loaded from file");
// _.each(data,(imageUrl)=>{
//     images[imageUrl]=1;
// });
// data=fs.readFileSync(un_filename,'utf8').split("\n");
// log.info(data.length+" unknown loaded from file");
// _.each(data,(imageUrl)=>{
//     images[imageUrl]=1;
// });

run(100);
setInterval(function(){
    log.info("image queue size",img_queue.length);
    log.info("post queue size",post_queue.length);
    run(1);
},60000);

eat("post",post_queue,getImages);
eat("post",post_queue,getImages);
eat("post",post_queue,getImages);


eat("image_1",img_queue,downloadImage);
eat("image_2",img_queue,downloadImage);
eat("image_3",img_queue,downloadImage);

function eat(name,queue,func){
    var task = queue.shift();
    if(task){
        func(task).then(
            function onFulfilled(){
                eat(name,queue,func)
            },
            function onReject(err){
                log.error(err);
                console.log(task);
                console.log(err.retry);
                if(err.retry){
                    queue.push(task);
                }
                eat(name,queue,func)
            }
        )
    }
    else{
        setTimeout(function(){;
            eat(name,queue,func)
        },30000)
    }
}

function run(n){
    return co(function *() {
        for(var i=1;i<=n;i++){
            var url=`http://bbs.hupu.com/bxj-${i}`;
            yield getPosts(url);
        }
    }).catch(
        function onRejected(err){
            log.error(err.stack);
        }
    )
}

function getPosts(url){
    return co(function *() {
        var html = yield new Promise(function (resolve, reject) {
            request(url,function (err, res, body) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(body);
                }
            }).on("error", function (err) {
                reject(err)
            })
        });
        //Get pages
        var $ = cheerio.load(html);
        $("#pl tr[mid]").each(function (index, elem) {
            var mid = $(elem).attr("mid");
            var viewreply = $(elem).find(".p_re").text().match(/(\d+).\/.(\d+)/);
            var reply = parseInt(viewreply[1]);
            var view = parseInt(viewreply[2]);
            //init when a new post come in
            if(!posts[mid]){
                posts[mid]={
                    curr:{
                        reply:reply,
                        view:view
                    },
                    prev: {
                        reply:-1,
                        view:0
                    }
                };
            }
            else{
                posts[mid].prev.reply=posts[mid].curr.reply;
                posts[mid].prev.view=posts[mid].curr.view;
                posts[mid].curr.reply=reply;
                posts[mid].curr.view=view;
            }
            //by comparing with old state, decide which page to crawl
            if(posts[mid].curr.reply>posts[mid].prev.reply){
                var startPage = Math.floor((posts[mid].prev.reply+1)/20)+1;
                var endPage = Math.floor((posts[mid].curr.reply)/20)+1;
                var todo_pages = [];
                if(posts[mid].prev.reply >= 19){
                    todo_pages.push(1);
                }
                for(var i=startPage; i<=endPage; i++){
                    todo_pages.push(i);
                }
                _.each(todo_pages, function (page) {
                    post_queue.push({
                        url:`http://bbs.hupu.com/${mid}-${page}.html`,
                        mid:mid
                    });
                });
            }
        });
        // return postsTodo;
    }).catch(function(err){
        log.error(err)
    });
}
function getImages(post) {
    return timeout(60*1000,co(function *() {
        var html = yield new Promise(function (resolve, reject) {
            request(post.url,function (err, res, body) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(body);
                }
            })
        });
        var $ = cheerio.load(html);
        $('img').each(function (index, elem) {
            var imageUrl = $(elem).attr("src");
            if(!imageUrl || images[imageUrl] || imageUrl.match(/_small_/) || imageUrl.length<5){
            }
            else {
                images[imageUrl]=1;
                // if(_.endsWith(imageUrl,".jpg")||_.endsWith(imageUrl,".png")||_.endsWith(imageUrl,".jpeg")){
                //     fs.appendFileSync(png_filename, imageUrl + "\n");
                //     img_queue.push({url: imageUrl, mid: post.mid});
                // }
                if(_.endsWith(imageUrl, ".gif")){
                    gifStream.write(imageUrl + "\n")
                    img_queue.push({url: imageUrl, mid: post.mid});
                }
                // else if(_.startsWith(imageUrl,"https://bbsstaticoss.hoopchina.com.cn")){
                //     fs.appendFileSync(un_filename,imageUrl+"\n");
                //     img_queue.push({url: imageUrl, mid: post.mid});
                // }
            }
        });
    })).catch(function(err){
        throw err;
    })
}

function downloadImage (image) {
    return timeout(60000,new Promise(function(resolve, reject){
        image.url=image.url.replace("FirstBbsImg","BbsImg").replace(/\*/g, '_').replace(/\?/g,'_');
        var imageName = ('' + image.mid + '_' + image.url.split('/')[image.url.split('/').length - 1]);
        if(_.endsWith(imageName,".jpg")||_.endsWith(imageName,".png")||_.endsWith(imageName,".jpeg")||_.endsWith(imageName,".gif")){

        }
        else{
            imageName +=".gif"
        }
        var inputStream = request.get(image.url);
        inputStream.on("error", function (err) {
            reject(err)
        });
        var outputStream = fs.createWriteStream(FOLDER + imageName);
        outputStream.on("error", function (err) {
            reject(err)
        });
        outputStream.on("finish", function () {
            resolve();
        });
        inputStream.pipe(outputStream);
    }))
}
function timeout(ms, promise) {
    return new Promise(function (resolve, reject) {
        promise.then(resolve, reject);
        setTimeout(function () {
            var err= new Error('Timeout after '+ms+' ms');
            err.retry = true;
            reject(err);
        }, ms);
    });
}
