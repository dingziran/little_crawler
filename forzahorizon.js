var request = require('request');
var fs = require('fs');
var bunyan = require('bunyan');
var log = bunyan.createLogger({name: 'image_creeper'});
var url = "http://www.forzamotorsport.net/Handlers/GetPhoto.ashx?game=fh3&id=$1&full=true";
var proxy = "http://localhost:1080"
function send(start,end,url){
	return new Promise(function(resolve,reject){
        var realUrl=url.replace("$1",start);
        request.head({url:realUrl,proxy:proxy,forever:true}, function (err,res,body) {
            if(err){
                reject(err)
            }
            else{
                if(res.headers["content-type"]=="image/jpeg"){
                    var inputStream=fs.createWriteStream('./pictures/'+start+'.jpg')
                    request({url:realUrl,proxy:proxy,forever:true})
                        .on("error", function (err) {
                            reject(err);
                        })
                        .pipe(inputStream).on('close', function (err) {
                            if (err) {
                                reject(err)
                            }
                            else {
                                resolve(true)
                            }
                        }).on('error', function (err) {
                            reject(err);
                        });
                    inputStream.on('error', function (err) {
                        reject(err);
                    });
                }
                else{
                    resolve(false);
                }
            }
        })

	}).then(
		function(result){
            if(result){
                log.info("complete "+start+".jpg");
            }
            else{
                log.error("skip "+start+"");
            }
			if(start<end){
				return send(start+1,end,url);
			}
			else{
				return;
			}
		},
		function(err){
			console.error("fail "+start+".jpg");
			console.error(err.stack);
			if(start<end){
				return send(start+1,end,url);
			}
			else{
				return;
			}
		}
    )
}//6380550
send(100000,500000,url).then(function(){console.log("all done")});
