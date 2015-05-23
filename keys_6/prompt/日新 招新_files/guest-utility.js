idl = typeof idl != "undefined" ? idl : {};

idl.maximizable_classes = ["img-wall","open-link","single-mode","ok-lightbox-on"];
idl.screen_height = (window.innerHeight || document.documentElement.clientHeight) || 1000;

var all_saved_con = ".all",
	content_area = ".note.editable",
	//with "g" modifier
	//顶级域名中出现[\d]+ 是为了匹配ip地址，但这样的话类似2.5之类的小数也被匹配上了，所以暂时先去掉
	//link_regexp = /((http\:\/\/|https\:\/\/|ftp\:\/\/)?([a-z0-9\-]+\.){0,5}[a-z0-9\-]+\.(?:[\d]+|com|cn|hr|io|org|do|fr|jp|tv|name|mobi|pro|us|fm|asia|net|gov|tel|la|travel|so|biz|info|hk|me|co|in|at|bz|ag|eu|in)\b(?:\:[\d+])?[^\s\,\"\'\[\]\{\}\<]{0,})/ig,
	link_regexp = /((http\:\/\/|https\:\/\/|ftp\:\/\/|\/\/)?([a-z0-9\-]+\.){0,5}[a-z0-9\-]+\.(?:com|cn|hr|io|edu|org|do|fr|jp|tv|name|mobi|pro|it|de|us|fm|asia|net|gov|tel|la|travel|so|biz|info|hk|me|co|in|at|bz|ag|eu|in)\b(?:\:[\d+])?[^\<\>\;\(\)\s\"\'\[\]\{\}\<]{0,})/ig,
	ip_link_regexp = /((http\:\/\/|https\:\/\/|ftp\:\/\/|\/\/)?[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}\b(?:\:[\d+])?[^\<\>\;\(\)\s\"\'\[\]\{\}\<]{0,})/ig,
	email_regexp = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}\b/i,
	email_field_regexp = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,4}$/i,
	///^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
	phonenum_regexp = /\(?\+?[\(\)\-\s\d]{6,20}/,
    isTouchSupported = 'ontouchstart' in window,
    isPointerSupported = navigator.pointerEnabled,
    isMSPointerSupported =  navigator.msPointerEnabled,
    downEvent = isTouchSupported ? 'touchstart' : (isPointerSupported ? 'pointerdown' : (isMSPointerSupported ? 'MSPointerDown' : '')),
    moveEvent = isTouchSupported ? 'touchmove' : (isPointerSupported ? 'pointermove' : (isMSPointerSupported ? 'MSPointerMove' : 'mousemove')),
    upEvent = isTouchSupported ? 'touchend' : (isPointerSupported ? 'pointerup' : (isMSPointerSupported ? 'MSPointerUp' : 'mouseup'));;


function getTimezone(){
    var script = document.createElement("script");
    script.onload = function(){
        var tz = jstz.determine(); // Determines the time zone of the browser client
        var timezone = tz.name(); // Returns the name of the time zone eg "Europe/Berlin"

        if(timezone){
            if(window.Tracker) Tracker.sendEvent("时区",timezone);
            Cookies.set("tz",timezone,365);
        }
        Cookies.set("GMT_bias",-new Date().getTimezoneOffset()/60,365);    
    };
    script.src = "/scripts/jstz.min.js";
    document.body.appendChild(script);
}

Cookies = {};
Cookies.set = function(name,value,days){
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        var expires = "; expires=" + date.toGMTString();
    } else {
        var expires = "";
    }
    document.cookie = name + "=" + value + expires + "; path=/";
    this[name] = value;
};

Cookies.remove = function(name){
    if(name) document.cookie = name+"=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/"
};

Cookies.get = function(name){
    var value = "; " + document.cookie;
    var parts = value.split("; " + name + "=");
    if (parts.length == 2) return parts.pop().split(";").shift();
};

var Tracker = {
    enabled: true,

    //保存未被发送的数据
    untracked: [],

    init: function(callback){
        tracker = this;
        this.startStamp = Date.now();

        if(window.ga){
            $("body").addClass("ga-tracker-on");

            if(callback && typeof $.isFunction(callback)) callback();

            if(window.self === window.top){
                this.sendEvent('Visit','direct');
            }else{
                this.sendEvent('Visit','frame');
            }

            //如果在init之前有未被发送的数据，现在一起发送
            if(this.untracked.length > 0){
                var track_info = null;

                for(var i=0,len=this.untracked.length; i<len; i++){
                    track_info = this.untracked[i];
                    if(track_info){
                        if(track_info.category){
                            tracker.sendEvent(track_info.category,track_info.action,track_info.label,track_info.weight);
                        }else if(track_info.pageurl){
                            tracker.sendPage(track_info.pageurl,track_info.pagetitle);
                        }

                        if(this.untracked.splice) this.untracked.splice(i,1);
                        else delete this.untracked[i];
                    }
                }
            }

            if(typeof window.onmessage != "undefined"){
                window.addEventListener("message",function(event){
                    var data = event.data;
                    
                    if(data && data.category){
                        data.label = data.label || "from extension";

                        tracker.sendEvent(data.category,data.action,data.label,data.weight);
                    }else if(data && data.pageUrl){
                        tracker.sendPage(data.pageurl,data.title);
                    }
                });
            }
        }else{

        }
    },

    sendEvent: function(category,action,label,weight){
        category = category || "UI Interation";
        action = action || "unknown";
        label = label ? label+"|registered" : "registered";
        weight = weight || 0;

        category = category.replace(/\b[a-z]/g, function(m){ return m.toUpperCase() });

        if(window.ga && this.enabled){
            try{
                ga('send','event',category,action,label,weight);
            }catch(e){
                console.log(e);
            }
        }else{
            //如果还没有准备好，则先记录到本地存储，得到init之后再取出来发送
            this.untracked.push({
                category:category,
                action: action,
                label: label,
                weight: weight
            });
        }
    },

    sendPage: function(pageurl,pagetitle){
        pageurl = pageurl || location.href;
        pagetitle = pagetitle || document.title;

        if(window.ga && this.enabled){
            ga('send','pageview',{
                page: pageurl,
                title: pagetitle
            });
        }else{
            this.untracked.push({
                pageurl: pageurl,
                pagetitle: pagetitle
            });
        }
    },

    stop: function(){
        this.enabled = false;
        $("body").removeClass("ga-tracker-on");
    },

    restart: function(){
        this.enabled = true;
        $("body").addClass("ga-tracker-on");
    },

    end: function(){
        this.sendEvent('leave',((Date.now() - this.startStamp)/(1000*60)).toString().replace(/(\.\d)\d+/,"$1")+" mins" );
    }
};


//NC会将用户从使用开始所有的任务记录在本地，
//如果本地任务被清空，或者是用户是从一个浏览器转换到另一个没有记录的浏览器，则需要在打开任务标签的时候从新获取所有今日任务

//暂时先假设用户不会清空了缓存不会换浏览器

//权限是在每次添加任务的时候检查，如果权限为default则进行请求
NotificationCenter = {
    //所有通知
    notifications: [],

    //提醒定时器
    alertTimer: null,

    alertTimers: [],

    //给出通知时间
    alertTime: ["09:00:00","14:30:00"],

    //提醒间隔
    duration: 1000 * 60 * 60 * 2,

    //提醒的图标
    icon: location.origin+"/layout/images/notification-icon.png",

    //是否被启用
    enabled: window.Notification && Notification.requestPermission,

    init: function(){
        if(!this.enabled) return ;

        var NC = this;
        this.notifications = [];

        if(typeof localStorage._notifications != "undefined"){
            try{
                var notifications = JSON.parse(localStorage._notifications);

                if(notifications.length > 0){
                    this.notifications = notifications;
                }
            }catch(e){
                Tracker.sendEvent('Notification','JSON parse error, localStorage._notifications is: '+localStorage._notifications);
            }
        }else{
            //之前从来没有添加过任务，或者本地没有获取到今日任务

            //如果是登陆用户则发送ajax请求得到所有今日任务
            // $.get("/task/today_tasks",function(data){
            //     try{
            //         var feedback = $.parseJSON(data);

            //         if(feedback.tasks){
            //             localStorage._notifications = JSON.stringify(feedback.tasks);
            //         }
            //     }catch(e){

            //     }
            // });
        }

        //初始化的时候会提醒一次，然后每两个小时提醒一次
        this.setAlertTimer();
    },

    setAlertTimer: function(){
        var NC = this;

        var todayDate = get_formated_time(Date.now(),false);

        var now = new Date();

        var hour = now.getHours();

        var timeout = 0;

        var alarm;

        //为每一次通知设置定时器
        this.alertTime.forEach(function(time){
            var datetime = new Date(todayDate+" "+time);

            if(datetime){
                //得到闹钟定时离现在的时间
                timeout = datetime.valueOf() - new Date().valueOf();
                timeout = timeout > 0 ? timeout : (Math.abs(timeout) < 10000 ? timeout : -1);

                if(timeout >= 0){
                    alarm = setTimeout(function(){
                        NC.notify();
                    },timeout);

                    NC.alertTimers.push(alarm);
                }
            }
        });


        // this.alertTimer = setInterval(function(){
        //     var now = new Date();

        //     var hour = now.getHours();

        //     //如果时间已经是用户当地的休息时间，则不给予提醒 ?
        //     if(hour >= 8 && hour < 22){
        //         NC.notify();
        //     }
        // },this.duration);
    },

    //通知用户今天的所有任务
    notify: function(){
        if(!this.enabled) return ;
        var NC = this;

        if(Notification.permission == "denied"){
            this.stop();
            return ;
        }

        var todayTaskIds = [];
        if(this.notifications.length > 0){
            var alertRecords = {},lastAlertTime = 0;
            
            if(localStorage._alertRecords) alertRecords = JSON.parse(localStorage._alertRecords);

            //得到今日任务，然后发出提醒
            var todayNotifications = this.notifications.filter(function(notification,i){

                lastAlertTime = alertRecords[notification.id] || 0;

                //截止期限小于或等于今日且离上次的提醒时间大于一定值才再次给出提醒
                if(notification.deadline == get_formated_time(Date.now(),false) && (Date.now() - lastAlertTime) > 10000 ){

                    //创建通知，
                    var n = new Notification('To Do',{body:notification.body+"\n\nDeadline:"+notification.deadline,tag:notification.id,icon:NC.icon});

                    //通知被关闭,任务不再提醒, 任务应该被设为已经完成状态
                    n.onclose = function(){

                    };

                    //通知被点击,会打开页面，然后在样式上强调给用户看
                    n.onclick = function(){

                    };

                    alertRecords[notification.id] = Date.now();

                    NC.notifications[i] = notification;
                    return true;
                }
            });

            if(todayNotifications.length > 0){
                localStorage._notifications = JSON.stringify(NC.notifications);
                localStorage._alertRecords = JSON.stringify(alertRecords);
            }
        }
    },

    //将新添加的有日期的任务加入通知列表,通知列表会被保存到localStorage._notifications
    queue: function(note){
        if(!this.enabled) return false;

        var NC = this;

        //如果用户还没有启用提醒功能，则请求权限
        if(Notification.permission == "default"){
            Notification.requestPermission(function(permission){
                if(permission == "granted"){

                }else if(permission == "denied"){
                    NC.stop();
                }
            });
        }

        //不管用户是否授权都加入提醒队列
        this.notifications = this.notifications || [];

        //检查是否已经存在id为note.id的提醒，如果已经存在则覆盖(将原有的删除)
        var index = null;
        var exists = this.notifications.filter(function(notification,i){
            if(notification.id == note.id){
                index = i;
                return true;
            }
        });

        if(exists && exists.length > 0){
            this.notifications.splice(index,1);
        }

        this.notifications.push({
            id: note.id,
            body: note.content,
            deadline: note.deadline
        });

        localStorage._notifications = JSON.stringify(this.notifications);
    },

    //关闭某一个通知
    remove: function(note){
        if(!this.enabled) return ;
        this.notifications = this.notifications || [];

        if(this.notifications.length > 0){
            var index = null;
            var exists = this.notifications.filter(function(notification,i){
                if(notification.id == note.id){
                    index = i;
                    return true;
                }
            });

            if(exists && exists.length > 0 && index !== null){
                this.notifications.splice(index,1);
            }

            localStorage._notifications = JSON.stringify(this.notifications);
        }
    },

    //清空通知中心
    clear: function(){
        if(!this.enabled) return ;
        localStorage._notifications = "";
        this.notifications = [];

        //清除闹钟
        this.alertTimers.forEach(function(timer){
            clearTimeout(timer);
        });
    },

    stop: function(){
        if(this.enabled){
            this.enabled = false;
            if(this.alertTimer) clearInterval(this.alertTimer);
        }
    },

    restart: function(){
        this.enabled = true;

        Notification.requestPermission(function(permission){
            if(permission == "granted"){
                this.init();
            }
        });
    },


};

//检测内容中是否含有地址
function containsAddress(content){
	//中文：检测字符串中"省"，"市"，"区"，"县"，"镇"，"乡"，"路"，"街"，"号"，"巷"等出现的索引,各个索引之间距离不超过一定字符数
	if(/([\W]{0,5}省)?\s{0,2}([\W]{0,5}市)?\s{0,2}[\W\d]+(区|路|镇|巷|乡|县|号|街|院|校|门)/.test(content) || /地址(\:|\：|\s)/i.test(content)){
		return true;
	}

	if(/([\s\w\,\.]{0,35}provice)?\s{0,2}([\s\w\,\.]{0,35}state)?\s{0,2}[\w\d\.]+(district|road|town|county|street)/.test(content) || /address(\:|\：|\s)/i.test(content)){
		return true;
	}
}

function is_contact(val){
    val = val.toString();
    //var reglution = /\d+/;
    //check_trans = check_id.match(reglution);
    if(check_adress(val) == 4){
        return 4;
    }else if (check_idcard(val) == 2){
        return 2;
    }else if(check_bank(val) == 1){
        return 1;
    }else if(check_phone(val) == 3){
        return 3;
    }
}

function check_bank(bank){
    var constr_bank = new Array();
        constr_bank[0] = /621700\d{13}/;
        constr_bank[1] = /436742/;
        constr_bank[2] = /436745/;
        constr_bank[3] = /622280[\d]{10}/;
        constr_bank[4] = /524094[\d]{10}/;
        constr_bank[5] = /421349[\d]{10}/;
        constr_bank[6] = /434061[\d]{10}/;
        constr_bank[7] = /434062[\d]{10}/;
        constr_bank[8] = /436718[\d]{10}/;
        constr_bank[9] = /436728[\d]{10}/;
        constr_bank[10] = /436738[\d]{10}/;
        constr_bank[11] = /436742[\d]{13}/;
        constr_bank[12] = /436745[\d]{10}/;
        constr_bank[13] = /436748[\d]{10}/;
        constr_bank[14] = /453242[\d]{10}/;
        constr_bank[15] = /489592[\d]{10}/;
        constr_bank[16] = /491031[\d]{10}/;
        constr_bank[17] = /524094[\d]{10}/;
        constr_bank[18] = /526410[\d]{10}/;
        constr_bank[19] = /532420[\d]{10}/;
        constr_bank[20] = /532430[\d]{10}/;
        constr_bank[21] = /532450[\d]{10}/;
        constr_bank[22] = /532458[\d]{10}/;
        constr_bank[23] = /544033[\d]{10}/;
        constr_bank[24] = /552245[\d]{10}/;
        constr_bank[25] = /552801[\d]{10}/;
        constr_bank[26] = /553242[\d]{10}/;
        constr_bank[27] = /558895[\d]{10}/;
        constr_bank[28] = /622166[\d]{10}/;
        constr_bank[29] = /622168[\d]{10}/;
        constr_bank[30] = /622280[\d]{10}/;
        constr_bank[31] = /622700[\d]{10}/;
        constr_bank[32] = /622728[\d]{10}/;
        constr_bank[33] = /622725[\d]{10}/;
        constr_bank[34] = /628266[\d]{10}/;
        constr_bank[35] = /628366[\d]{10}/;
        //constr_bank[36] = /[\d]{15,19}/;
        //constr_bank[37] = //;
    var conmme_bank = new Array();
        conmme_bank[0] = /427020/;
        conmme_bank[1] = /427030/;
        conmme_bank[2] = /530990/;
        conmme_bank[3] = /622230/;
        conmme_bank[4] = /622235/;
        conmme_bank[5] = /622210/;
        conmme_bank[6] = /622215/;
        conmme_bank[7] = /622200/;
        conmme_bank[8] = /955880/;
        conmme_bank[9] = /1020000/;
        conmme_bank[10] = /370246[\d]{9}/;
        conmme_bank[11] = /370247[\d]{9}/;
        conmme_bank[12] = /370248[\d]{9}/;
        conmme_bank[13] = /370249[\d]{9}/;
        conmme_bank[14] = /489736[\d]{9}/;
        conmme_bank[15] = /489735[\d]{9}/;
        conmme_bank[16] = /489734[\d]{9}/;
        conmme_bank[17] = /438125[\d]{10}/;
        conmme_bank[18] = /438126[\d]{10}/;
        conmme_bank[19] = /451804[\d]{10}/;
        conmme_bank[20] = /451810[\d]{10}/;
        conmme_bank[21] = /458060[\d]{10}/;
        conmme_bank[22] = /458071[\d]{10}/;
        conmme_bank[23] = /489734[\d]{10}/;
        conmme_bank[24] = /489735[\d]{10}/;
        conmme_bank[25] = /489736[\d]{10}/;
        conmme_bank[26] = /510529[\d]{10}/;
        conmme_bank[27] = /402791[\d]{10}/;
        conmme_bank[28] = /427010[\d]{10}/;
        conmme_bank[29] = /427018[\d]{10}/;
        conmme_bank[30] = /427019[\d]{10}/;
        conmme_bank[31] = /427020[\d]{10}/;
        conmme_bank[32] = /427028[\d]{10}/;
        conmme_bank[33] = /427038[\d]{10}/;
        conmme_bank[34] = /427029[\d]{10}/;
        conmme_bank[35] = /427039[\d]{10}/;
        conmme_bank[36] = /427062[\d]{10}/;
        conmme_bank[37] = /427064[\d]{10}/;
        //conmme_bank[38] = /[\d]{15,19}/;
        /*conmme_bank[39] = /[\d]{10}/;
        conmme_bank[40] = /[\d]{10}/;
        conmme_bank[41] = /[\d]{10}/;
        conmme_bank[42] = /[\d]{10}/;
        conmme_bank[43] = /[\d]{10}/;
        conmme_bank[44] = //;
        conmme_bank[] = //;
        conmme_bank[] = //;
        conmme_bank[] = //;
        conmme_bank[] = //;
        conmme_bank[] = //;
        conmme_bank[] = //;
        conmme_bank[] = //;*/
    var agricu_bank = new Array();
        agricu_bank[0] = /103000[\d]{13}/;
        agricu_bank[1] = /403361[\d]{10}/;
        agricu_bank[2] = /404117[\d]{10}/;
        agricu_bank[3] = /491020[\d]{10}/;
        agricu_bank[4] = /519412[\d]{10}/;
        agricu_bank[5] = /520082[\d]{10}/;
        agricu_bank[6] = /535910[\d]{10}/;
        agricu_bank[7] = /535918[\d]{10}/;
        agricu_bank[8] = /552599[\d]{10}/;
        agricu_bank[9] = /558730[\d]{10}/;
        agricu_bank[10] = /622821[\d]{13}/;
        agricu_bank[11] = /622822[\d]{13}/;
        agricu_bank[12] = /622823[\d]{13}/;
        agricu_bank[13] = /622824[\d]{13}/;
        agricu_bank[14] = /622825[\d]{13}/;
        agricu_bank[15] = /622836[\d]{10}/;
        agricu_bank[16] = /622837[\d]{10}/;
        agricu_bank[17] = /622840[\d]{13}/;
        agricu_bank[18] = /622844[\d]{13}/;
        agricu_bank[19] = /622845[\d]{13}/;
        agricu_bank[20] = /622846[\d]{13}/;
        agricu_bank[21] = /622847[\d]{13}/;
        agricu_bank[22] = /622848[\d]{13}/;
        //agricu_bank[23] = /\d{15,19}/;
        /*agricu_bank[] = //;
        agricu_bank[] = //;
        agricu_bank[] = //;*/
    var china_bank = new Array();
        china_bank[0] = /356833[\d]{10}/;
        china_bank[1] = /356835[\d]{10}/;
        china_bank[2] = /400937[\d]{10}/;
        china_bank[3] = /400938[\d]{10}/;
        china_bank[4] = /400939[\d]{10}/;
        china_bank[5] = /400940[\d]{10}/;
        china_bank[6] = /400941[\d]{10}/;
        china_bank[7] = /400942[\d]{10}/;
        china_bank[8] = /409665[\d]{10}/;
        china_bank[9] = /409666[\d]{10}/;
        china_bank[10] = /409667[\d]{10}/;
        china_bank[11] = /409668[\d]{10}/;
        china_bank[12] = /409669[\d]{10}/;
        china_bank[13] = /409670[\d]{10}/;
        china_bank[14] = /409671[\d]{10}/;
        china_bank[15] = /424106[\d]{10}/;
        china_bank[16] = /424107[\d]{10}/;
        china_bank[17] = /424108[\d]{10}/;
        china_bank[18] = /424109[\d]{10}/;
        china_bank[19] = /424110[\d]{10}/;
        china_bank[20] = /424111[\d]{10}/;
        china_bank[21] = /438088[\d]{10}/;
        china_bank[22] = /451291[\d]{10}/;
        china_bank[23] = /456351[\d]{10}/;
        china_bank[24] = /493878[\d]{10}/;
        china_bank[25] = /512315[\d]{10}/;
        china_bank[26] = /512316[\d]{10}/;
        china_bank[27] = /512411[\d]{10}/;
        china_bank[28] = /512412[\d]{10}/;
        china_bank[29] = /512695[\d]{10}/;
        china_bank[30] = /512732[\d]{10}/;
        china_bank[31] = /514957[\d]{10}/;
        china_bank[32] = /514958[\d]{10}/;
        china_bank[33] = /518378[\d]{10}/;
        china_bank[34] = /518379[\d]{10}/;
        china_bank[35] = /518474[\d]{10}/;
        china_bank[36] = /518475[\d]{10}/;
        china_bank[37] = /518476[\d]{10}/;
        china_bank[38] = /522153[\d]{10}/;
        china_bank[39] = /524864[\d]{10}/;
        china_bank[40] = /524865[\d]{10}/;
        china_bank[41] = /525745[\d]{10}/;
        china_bank[42] = /525746[\d]{10}/;
        china_bank[43] = /540297[\d]{10}/;
        china_bank[44] = /540838[\d]{10}/;
        china_bank[45] = /541068[\d]{10}/;
        china_bank[46] = /547628[\d]{10}/;
        china_bank[47] = /547648[\d]{10}/;
        china_bank[48] = /547766[\d]{10}/;
        china_bank[49] = /552742[\d]{10}/;
        china_bank[50] = /553131[\d]{10}/;
        china_bank[51] = /558808[\d]{10}/;
        china_bank[52] = /558809[\d]{10}/;
        china_bank[53] = /558868[\d]{10}/;
        china_bank[54] = /601382[\d]{10}/;
        china_bank[55] = /622346[\d]{10}/;
        china_bank[56] = /622347[\d]{10}/;
        china_bank[57] = /622348[\d]{10}/;
        china_bank[58] = /622750[\d]{10}/;
        china_bank[59] = /622751[\d]{10}/;
        china_bank[60] = /622752[\d]{10}/;
        china_bank[61] = /622753[\d]{10}/;
        china_bank[62] = /622754[\d]{10}/;
        china_bank[63] = /622755[\d]{10}/;
        china_bank[64] = /622756[\d]{10}/;
        china_bank[65] = /622757[\d]{10}/;
        china_bank[66] = /622758[\d]{10}/;
        china_bank[67] = /622759[\d]{10}/;
        china_bank[68] = /622760[\d]{10}/;
        china_bank[69] = /622761[\d]{10}/;
        china_bank[70] = /622762[\d]{10}/;
        china_bank[71] = /622763[\d]{10}/;
        china_bank[72] = /622770[\d]{13}/;
        //china_bank[73] = /[\d]{16,19}/;
        /*china_bank[] = /[\d]{10}/;
        china_bank[] = /[\d]{10}/;*/
    for(var i = 0; i < constr_bank.length; i++){
        var flag = constr_bank[i].test(bank);
        if(flag){
            return 1;   //表示银行
        }
    }
    for(var i = 0; i<conmme_bank.length; i++){
        var flag = conmme_bank[i].test(bank);
        if(flag){
            return 1;   //表示银行
        }
    }

    for(var i = 0; i<agricu_bank.length; i++){
        var flag = agricu_bank[i].test(bank);
        if(flag){
            return 1;   //表示银行
        }
    }

    for(var i = 0; i<china_bank.length; i++){
        var flag = china_bank[i].test(bank);
        if(flag){
            return 1;   //表示银行
        }
    }

    for(var i = 0; i<china_bank.length; i++){
        var flag = china_bank[i].test(bank);
        if(flag){
            return 1;   //表示银行
        }
    }
    
}

function check_idcard(id_numb){
    var identity = /(\W|\b)\d{17,17}(\d|x)(\W|\b)/;
    var sobj = id_numb.match(identity);
    var nowtime = new Date();
    var nowyear = nowtime.getFullYear();
    if(sobj == null) return false;
    for(var i = 0; i<sobj[i].length; i++){
        if(sobj[i].length == 18){
            var first_char = sobj[i].charAt(0);
            if(first_char == '9'){
                return false;
            }else{
                var year = sobj[i].substr(6,4);
                var month = sobj[i].substr(10,2);
                var date = sobj[i].substr(12,2);
                if((year>=nowyear-150&&year<=nowyear)&&(month<=12)&&(date<=31)){
                    //return '身份证';
                    return 2;   //表示身份证
                }else{
                    //跳出函数或执行其他函数
                }
            }
        }
    }
}

function check_phone(phone_number){
    var reg = new Array();
        reg[0] = /(\W|\b)(1)[\d]{10}(\W|\b)/;
        reg[1] = /(\W|\b)[\d]{4}(-|)\d{8}(\W|\b)/;
        reg[2] = /(\W|\b)[\d]{3,6}-\d{5,15}(\W|\b)/;

        for(var i in reg){
            var sobj = reg[i].test(phone_number);

            var num_length = phone_number.match(reg[i]);
            if (sobj&&num_length.length<=15) {
                return 3;   //表示电话号码
            }
        }
}


function check_adress(adress){
    var reg = new Array();
        reg[0] = /市/;
        reg[1] = /区/;
        reg[2] = /路/;
        reg[3] = /省/;
        reg[4] = /号/;
        reg[5] = /镇/;
        reg[6] = /乡/;
        reg[7] = /村/;
        reg[8] = /州/;
        reg[9] = /县/;
        reg[10] = /村/;
    var reg_count = 0;
    for (var i in reg){
        var flag = reg[i].test(adress);
        if(flag){
            reg_count++;
        }
    }
    if(reg_count >= 4){
        return 4;   //表示地址
    }
}

function detect_link(contentdiv){
    var $form = null;
    if(contentdiv){
        $form = $(contentdiv).closest("form.note");
    }else return false;

    $form.removeClass("got-link");

    var w = window,d=document;
    if(w.getSelection){
        var sel = w.getSelection();
        //如果并没有选中文字，则判断光标所处位置是否存在链接，存在的话则去掉对应链接(还要判断是否文字是url)
        if(sel.isCollapsed || sel.type == "Caret"){
            //找到最外层节点
            var wrapperNode = null;
            if(sel.anchorNode) wrapperNode = sel.anchorNode.parentNode;

            if(wrapperNode && wrapperNode.nodeName == "A"){
                if($(wrapperNode).attr("rel") != "image"){
                    $form.addClass("got-link");
                    return true;
                }else{
                    $form.removeClass("got-link");
                }
            }else if(wrapperNode){
                //从最外层节点中找到所有链接
                var as = wrapperNode.querySelectorAll("a");

                if(as && as.length > 0){
                    $(as).each(function(i,link){
                        if($(link).attr("rel") != "image"){
                            return false;
                        }
                    });
                }
            }
        }else if(!sel.isCollapsed || sel.type == "Range"){
            //将选取的内容中的a标签全部清除，
            var startNode = sel.anchorNode.parentNode;
            var endNode = sel.focusNode.parentNode;
            
            //选中了一个A标签中的某些内容，清除此链接即可
            if(startNode == endNode && startNode.nodeName == "A"){
                if($(startNode).attr("rel") != "image"){
                    $form.addClass("got-link");
                    return true;
                }
            }else{
                //去掉开头处的链接，如果存在的话
                if(startNode && startNode.nodeName == "A"){
                    if($(startNode).attr("rel") != "image"){
                        $form.addClass("got-link");
                        return true;
                    }
                }

                //去掉结尾处的链接
                if(endNode && endNode.nodeName == "A"){
                    if($(endNode).attr("rel") != "image"){
                        $form.addClass("got-link");
                        return true;
                    }
                }
            }
        }
    }else if(d.selection){
        var ran = d.selection.createTextRange();
        if(ran.boundingWidth == 0 || ran.htmlText == ""){
            var ancestor = ran.parentElement();
            var as = ancestor.getElementsByTag("a");
            if(as && as.length > 0){
                $(as).each(function(i,link){
                    if($(link).attr("rel") != "image"){
                        $form.addClass("got-link");
                        return true;
                    }
                });
            }
        }else{
            var html = ran.htmlText;
            var token = "---has-the-no-image-link---";
            //检测文字中是否有非图片链接
            html = html.replace(/\<a[^><]{0,}href\=["']?([^'"><]+)["']?[^><]{0,}\>([^><]{0,})(?:\<\/a\>)?/ig,function(match,url,title,offset,string){
                if(match.match(/\<a[^><]{0,}href\=["']?([^'"><]+)["']?[^><]{0,}rel\=["']?image["']?[^><]{0,}\>([^><]{0,})(?:\<\/a\>)?/)){
                    return match;
                }else{
                    return token;
                }
            });

            if(html.indexOf("token") >= 0){
                $form.addClass("got-link");
                return true;
            }
        }
    }
    $form.removeClass("got-link");
}

function delink(){
    var w = window,d=document;
    if(w.getSelection){
        var sel = w.getSelection();
        //如果并没有选中文字，则判断光标所处位置是否存在链接，存在的话则去掉对应链接(还要判断是否文字是url)
        if(sel.isCollapsed || sel.type == "Caret"){
            //找到最外层节点
            var wrapperNode = null;
            if(sel.anchorNode) wrapperNode = sel.anchorNode.parentNode;;
            if(wrapperNode && wrapperNode.nodeName == "A"){
                if($(wrapperNode).attr("rel") != "image"){
                    wrapperNode.outerHTML = wrapperNode.innerText || wrapperNode.textContent;
                }
            }else if(wrapperNode){
                //从最外层节点中找到所有链接
                var as = wrapperNode.querySelectorAll("a");

                if(as && as.length > 0){
                    for(var i=0,len=as.length; i<len; i++){
                        var a = as[i];
                        if($(a).attr("rel") != "image"){
                            //a.outerHTML = a.innerText || a.textContent;
                        }
                    }
                }
            }
        }else if(!sel.isCollapsed || sel.type == "Range"){
            //将选取的内容中的a标签全部清除，
            var startNode = sel.anchorNode.parentNode;
            var endNode = sel.focusNode.parentNode;
            
            //选中了一个A标签中的某些内容，清除此链接即可
            if(startNode == endNode && startNode.nodeName == "A"){
                if($(startNode).attr("rel") != "image"){
                    startNode.outerHTML = startNode.innerText || startNode.textContent;
                }
            }else{
                //去掉开头处的链接，如果存在的话
                if(startNode && startNode.nodeName == "A"){
                    if($(startNode).attr("rel") != "image"){
                        startNode.outerHTML = startNode.innerText || startNode.textContent;
                    }
                }

                //去掉结尾处的链接
                if(endNode && endNode.nodeName == "A"){
                    if($(endNode).attr("rel") != "image"){
                        endNode.outerHTML = endNode.innerText || endNode.textContent;
                    }
                }

                var ran = sel.getRangeAt(0);
                var frag = ran.cloneContents();
                
                var as = frag.querySelectorAll("a");

                if(as && as.length > 0){
                    //documentFragment不能使用outerHTML属性设置
                    for(var i=0,len=as.length; i<len; i++){
                        var a = as[i];
                        var text = a.innerText || a.textContent;
                        if($(a).attr("rel") != "image"){
                            a.parentNode.insertBefore(document.createTextNode(text),a);
                            a.remove();
                        }
                    }
                }

                ran.deleteContents();
                ran.insertNode(frag);
            }
        }
    }else if(d.selection){
        var ran = d.selection.createTextRange();
        if(ran.boundingWidth == 0 || ran.htmlText == ""){
            var ancestor = ran.parentElement();
            var as = ancestor.getElementsByTag("a");
            if(as && as.length > 0){
                //documentFragment不能使用outerHTML属性设置
                for(var i=0,len=as.length; i<len; i++){
                    var a = as[i];
                    var text = a.innerText || a.textContent;
                    if($(a).attr("rel") != "image"){
                        a.parentNode.insertBefore(document.createTextNode(text),a);
                        a.remove();
                    }
                }
            }
        }else{
            var html = ran.htmlText;

            //替换所有非图片链接为文字
            html = html.replace(/\<a[^><]{0,}href\=["']?([^'"><]+)["']?[^><]{0,}\>([^><]{0,})(?:\<\/a\>)?/ig,function(match,url,title,offset,string){
                if(match.match(/\<a[^><]{0,}href\=["']?([^'"><]+)["']?[^><]{0,}rel\=["']?image["']?[^><]{0,}\>([^><]{0,})(?:\<\/a\>)?/)){
                    return match;
                }else{
                    return match.replace(/\<a[^><]{0,}href\=["']?([^'"><]+)["']?[^><]{0,}\>([^><]{0,})(?:\<\/a\>)?/ig,"<a class=\"open\" href=\""+loc_origin+"/#$1\" rel=\"link\">$2</a>");
                }
            });
            ran.pasteHTML(html);
        }
    }
}

function get_link_in_url(url){
    if(url.indexOf("#") != -1){
        var hash = url.substr(url.indexOf("#")+1);

        if(hash == "" || (!hash.match(link_regexp) && !hash.match(ip_link_regexp)) || hash.length > 2048){
            return false;
        }else{
            if(hash.indexOf('http') < 0){
                hash = "http://"+hash;
            }
            return hash;
        }
    }
}

function load_first_image(content_node){
    if(!content_node) return false;
    var feature_img = $(content_node).find("a[rel=\"image\"]").attr("data-lightbox","in-memo").eq(0).removeAttr("data-lightbox").get(0);

    if(feature_img){
        var img_node = document.createElement("img");
        //img_node.onload = ;
        is_image_url(feature_img.href,img_entity_onload,img_node);

        img_node.onerror = function(){
            //加载失败，将图片去除
            $(this).closest(".img-entity").removeClass("entity-loaded");
            this.remove();
        };

        img_node.src = feature_img.href;
        var filename = get_filename(feature_img.href);
        $(content_node).closest(".field-con").find(".entities-con .img-entity").html("<a class=\"lb entity\" data-lightbox=\"in-memo\" href=\""+feature_img.href+"\"></a><a class=\"img-downloader\" href=\""+feature_img.href+"\" download=\""+filename+"\"></a>").find("a.lb.entity").append(img_node);
    }
}

function getUrlVars(){
    var vars = {}, hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for(var i = 0; i < hashes.length; i++){
        hash = hashes[i].split('=');
        if(hash.length == 2){
            vars[hash[0]] = hash[1];
        }
    }
    return vars;
}

function load_image_entity(content_node,dir){
    if(!content_node) return false;
    var feature_img,current_idx;
    var $note_con = $(content_node).closest(".note-con");
    var $imgs = $note_con.find("a[rel=\"image\"]");
    var imgs_num = $imgs.length;

    if(imgs_num == 0){
        return false;
    }else{
        if(imgs_num > 1) $note_con.addClass("multi-entities");
        else $note_con.addClass("single-entity");
    }


    if(!dir){
        //没有设定方向，则取第一张图片
        feature_img = $imgs.attr("data-lightbox","in-memo").eq(0).removeAttr("data-lightbox").get(0);
        current_idx = 0;
    } else {
        var last_idx = $note_con.find(".entities-con .img-entity").data("current_idx");
        if(!last_idx){
            var last_idx = 0;
            var $current_displayed = $note_con.find(".lb.entity img");
            
            $imgs.each(function(idx){
                if(this.href == $current_displayed.attr("src")){
                    last_idx = idx;
                    return false;
                }
            });
        }

        if(imgs_num > 1 && last_idx >= 0){
            var next_idx;

            //图片导航
            if(dir == "prev"){
                //展示前一张图片
                next_idx = last_idx - 1 >= 0 ? last_idx - 1 : imgs_num - 1;
            }else if(dir == "next"){
                //展示后一张图片
                next_idx = last_idx + 1 == imgs_num ? 0 : last_idx + 1;
            }

            feature_img = $imgs[next_idx];
            current_idx = next_idx;
        }
        
    }

    if(feature_img){
        var img_node = document.createElement("img");
        //http://m.okay.do/layout/images/1px.gif

        if(elementInViewport(content_node)){
            is_image_url(feature_img.href,img_entity_onload,img_node);

            img_node.onload = function(){
                // $(this).hide();
                // $(this).delay(150).fadeTo('slow',1);
            };

            img_node.onerror = function(){
                //加载失败，将图片去除
                $(this).closest(".img-entity").removeClass("entity-loaded");
                this.remove();
            };

            img_node.src = feature_img.href;
            var filename = get_filename(feature_img.href);

            $(content_node).closest(".field-con")
                            .find(".entities-con .img-entity").data("current_idx",current_idx)
                            .html("<a class=\"lb entity\" data-lightbox=\"in-memo\" href=\""+feature_img.href+"\"></a>"+
                                "<a class=\"img-downloader\" href=\""+feature_img.href+"\" download=\""+filename+"\"><span class=\"icon-font  ok-icon-download\"></span></a>"+
                                "<div class=\"entities-nav\">"+
                                    "<a class=\"prev\" href=\"#\"><span class=\"icon-font ok-icon-chevronLeft\"></span></a>"+
                                    "<a class=\"next\" href=\"#\"><span class=\"icon-font ok-icon-chevronRight\"></span></a>"+
                                "</div>")
                            .find("a.lb.entity").append(img_node);
        }else{
            var img_node = new Image();
                img_node.src="/layout/images/1px.gif"
                img_node.class = "";
                img_node.setAttribute("data-src",feature_img.href);
                var filename = get_filename(feature_img.href);
            //如果图片还不在视线范围内，则之后再加载
            $(content_node).closest(".field-con")
                            .find(".entities-con .img-entity").data("current_idx",current_idx).addClass("loading")
                            .html("<a class=\"lb entity\" data-lightbox=\"in-memo\" href=\""+feature_img.href+"\"></a>"+
                                "<a class=\"img-downloader\" href=\""+feature_img.href+"\" download=\""+filename+"\"><span class=\"icon-font  ok-icon-download\"></span></a>"+
                                "<div class=\"entities-nav\">"+
                                    "<a class=\"prev\" href=\"#\"><span class=\"icon-font ok-icon-chevronLeft\"></span></a>"+
                                    "<a class=\"next\" href=\"#\"><span class=\"icon-font ok-icon-chevronRight\"></span></a>"+
                                "</div>")
                            .find("a.lb.entity").append(img_node);
        }
    }
}

function img_entity_onload(){
    var $entity_con = $(this).closest(".img-entity");

    //通过添加类让父元素宽高度有所变化
    $entity_con.addClass("entity-loaded");

    $entity_con.find("a.lb.entity").attr("data-title",this.width+"X"+this.height);

    //加载成功，对图片进行定位缩放
    var con_width = $entity_con.width();
    var con_height = $entity_con.height();

    var img_width = this.width;
    var img_height = this.height;

    this.setAttribute("data-width",this.width);
    this.setAttribute("data-height",this.height);

    //图片只有跟容器大小比例在一定范围内才缩放，例如，如果图片比容器为<1/4的话，则不进行缩放，如果是>3/4的话，则可以让其充满容器
    var min_ratio = .85;
    //如果图片宽度大于或等于容器宽度
    if(img_width >= con_width){
        //宽度撑满容器宽度
        this.style.width = "100%";
        if(img_height >= con_height){
            //图片宽高度都大于容器宽高度
            //尝试将图片等比例缩放，让宽度与容器相等,若缩放后图片高度小于容器高度，则不进行缩放，让图片水平垂直方向上皆居中即可
            var croped_height = img_height * (con_width/img_width);
            
            if(croped_height >= con_height){
                //croped_height > 1.3 * con_height
                if( croped_height * (1-0.618) > con_height * .5 ){
                    var diff = croped_height * (1-0.618) - con_height * .5;
                    this.style.marginTop = -diff + "px";
                }else{
                    var diff = - con_height + croped_height;
                    this.style.marginTop = -diff/2 + "px";
                }
            }else{
                //缩放后的高度小于容器高度，
                //将高度撑满
                croped_width = img_width * (con_height/img_height);

                //垂直方向上居中
                var diff = croped_width - con_width;
                this.style.height = "100%";
                this.style.width = "auto";
                this.style.marginLeft = -diff/2 + "px";
            }
        }else{
            //图片宽大于容器宽，高小于容器
            //让其宽度撑满容器，并在垂直方向上居中
            var diff = con_height - img_height;
            this.style.marginTop = diff/2 + "px";
        }
    }else{
        if((img_width/con_width) >= min_ratio){
            //如果宽度比在一定值以上，则让其宽度变为100%，再垂直居中或者将黄金分割线设为垂直上的中线
            this.style.width = "100%";
            var croped_height = img_height * (img_width/con_width);
            if(croped_height >= con_height){
                //croped_height > 1.3 * con_height
                if( croped_height * (1-0.618) > con_height * .5 ){
                    var diff = croped_height * (1-0.618) - con_height * .5;
                    this.style.marginTop = -diff + "px";
                }else{
                    var diff = - con_height + croped_height;
                    this.style.marginTop = -diff/2 + "px";
                }
            }else{
                //缩放后的高度小于容器高度，垂直方向上居中
                var diff = con_height - croped_height;
                this.style.marginTop = diff/2 + "px";
            }
        }else{
            //不能让图片变为100%，也就是不对其进行缩放
            //如果自然高度大于容器高度
            if(img_height > con_height){
                if(img_height >= con_height){
                    //img_height > 1.3 * con_height
                    if( img_height * (1-0.618) > con_height * .5 ){
                        var diff = img_height * (1-0.618) - con_height * .5;
                        this.style.marginTop = -diff + "px";
                    }else{
                        var diff = - con_height + img_height;
                        this.style.marginTop = -diff/2 + "px";
                    }
                }
            }else{
                var diff = con_height - img_height;
                this.style.marginTop = diff/2 + "px";
            }

        }
    }
};

//根据搜索区域标签容器大小来给所有标签进行分页
function relocate_tags(tag_container,tag_selector){
	tag_selector = tag_selector ? tag_selector : ".tag-con";
	var $tags = $(tag_selector,tag_container);
	var container_offset = $(tag_container).offset();
	var row_height = $tags.height();

	//遍历所有标签，每三排包含在一个子容器中
	$tags.each(function(){
		if($(this).offset().top > (2 * row_height + container_offset.top) && $(this).offset().top < (6 * row_height + container_offset.top)){
			//这是第一个子容器
			console.log(this);
		}

		if($(this).offset().top > (5 * row_height + container_offset.top) && $(this).offset().top < (9 * row_height + container_offset.top)){
			//这是第一个子容器
			console.log(this);
		}


	});
}

//翻译脚本动态添加的消息
function _translate(){
    var translated = idl._script_lang[arguments[0]];
    if(!translated) return "";

    if(arguments.length == 1){
        return translated;
    }

    var args = arguments;
    //带有参数
    //var args = Array.prototype.slice.call(arguments);
    var i = 0;
    
    return translated.replace(/\$1/g,function(match,idx,string){
        i++;
        return args[i] ? args[i] : match;
    });
}

function change_position(direction,srcpos,dstpos){
    var position;

    if(direction == "up"){
        $(".task.note-con").each(function(){
            position = $(this).data("position");

            if(position >= srcpos && position <= dstpos){
                if((position - 1) < srcpos){
                    $(this).data("position",dstpos).attr("data-position",dstpos);
                }else{
                    $(this).data("position",position-1).attr("data-position",position-1);
                }
            }
        });
    }else{
        $(".task.note-con").each(function(){
            position = $(this).data("position");

            if(position <= srcpos && position >= dstpos){
                if((position + 1) > srcpos){
                    $(this).data("position",dstpos).attr("data-position",dstpos);
                }else{
                    $(this).data("position",position+1).attr("data-position",position+1);
                }
            }
        });
    }
}

function change_order(direction,srcpos,dstpos){
    var position;

    if(direction == "down"){
        $("#search_area .tag-con").not(".all").not(".tmp-pined").not(".clone").each(function(){
            position = $(this).data("position");

            if(position >= srcpos && position <= dstpos){
                if((position - 1) < srcpos){
                    $(this).data("position",dstpos).attr("data-position",dstpos);
                }else{
                    $(this).data("position",position-1).attr("data-position",position-1);
                }
            }
        });
    }else{
        $("#search_area .tag-con").not(".all").not(".tmp-pined").not(".clone").each(function(){
            position = $(this).data("position");

            if(position <= srcpos && position >= dstpos){
                if((position + 1) > srcpos){
                    $(this).data("position",dstpos).attr("data-position",dstpos);
                }else{
                    $(this).data("position",position+1).attr("data-position",position+1);
                }
            }
        });
    }
}

//在右边打开某一个窗口关闭其他窗口
function show_window(which){
    var $body = $(document.body);
    switch(which){
        case "open-link":
            if($body.hasClass("img-wall")) $body.removeClass("img-wall");
            if($body.hasClass("single-mode")) $(".note-con.maximized .minimize-note").trigger("click");
            break;
        case "img-wall":
            if($body.hasClass("open-link")) $body.removeClass("open-link");
            if($body.hasClass("single-mode")) $(".note-con.maximized .minimize-note").trigger("click");
            break;
        case "note":
            $body.removeClass("img-wall").removeClass("open-link");
            break;
        default: return false;
    }
}

function pop_window(classstr){
    var window_map = {
        "img-wall": "#image_wall",
        "open-link": "#new_windows",
        "single-mode": ".note-con.maximized",
        "ok-lightbox-on": ".lightboxOverlay,#lightbox"
    };

    var $body = $("body");
    var exists = maximized_exists();


    if(window_map[classstr]){
        $(window_map[classstr].split(",")).each(function(i,v){
            var $tab = $(v+".ok-tab");
            $tab.removeClass("ok-tab").removeClass("lowest-window").removeClass("highest-window");
            var win_classes = $tab.attr("class").match(/current\-window\-\d/g);
            $(win_classes).each(function(i,v){
                $tab.removeClass(v);
            });
        });
    }

    if(!exists || exists == classstr) $body.removeClass("full-page");
}

function push_window(classstr){
    if(!idl.window_stack) idl.window_stack = [];
    var window_map = {
        "img-wall": "#image_wall",
        "open-link": "#new_windows",
        "single-mode": ".note-con.maximized",
        "ok-lightbox-on": ".lightboxOverlay,#lightbox"
    };

    //如果之前已经被推入栈，则将其放到第一位
    var cur = idl.window_stack.indexOf(classstr);
    
    //从数组中去掉
    if( cur >= 0){
        idl.window_stack.splice(cur,1);
    }

    //放到数组的最后
    idl.window_stack.push(classstr);
    $(".highest-window").removeClass("highest-window");
    $(".lowest-window").removeClass("lowest-window");

    $("body").removeClass("note-highest");
    $(idl.window_stack).each(function(i,v){
        if(window_map[v]){
            $(".current-window-"+i).removeClass("current-window-"+i);
            if(i == 0) $(window_map[v]).addClass("lowest-window");
            if(i == idl.window_stack.length-1){
                $(window_map[v]).addClass("highest-window");
                if(v == "single-mode") $("body").addClass("note-highest");
            }
            $(window_map[v]).addClass("ok-tab current-window-"+i);
        }
    });
}

function maximized_exists(){
    var classstr = false;
    for(var i=0,len=idl.maximizable_classes.length; i<len; i++){
        classstr = idl.maximizable_classes[i];
        if(classstr && jQuery("body").hasClass(classstr)) return classstr;
    }
    return false;
}

function download_img(image){
	//先将img转换为canvas
	var canvas = document.createElement("canvas");
		canvas.setAttribute("class","dl-canvas");
		canvas.width = image.width;
		canvas.height = image.height;
		canvas.getContext("2d").drawImage(image,0,0);
		var dl_image = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream"); 
        window.location.href=dl_image;
}

function regen_tasks_order(){
	//重置所有顺序
    var i = 0;
    $("#search_results.results-of-tasks .note-con").each(function(){
        $(this).attr("data-order",i).data("order",i);
        i += 1;
    });
}

function scroll_into_view(el,extra){
	extra = extra ? extra : -100;
	$("html,body").animate({scrollTop:$(el).offset().top + extra});
}

function recount_today_tasks(reason){
    var $num_con = $("#tag_tasks span.today-num");
    var today_tasks_num = $num_con.text();
    if(reason == "delete" || reason == "finished" || reason == "change_date"){
        console.log(today_tasks_num);
        if(today_tasks_num > 1){
            $num_con.text(parseInt(today_tasks_num) - 1);
        }else{
            $num_con.text(0).addClass("all-finished");
            idl.apps.note.tasks.today_tasks_num = 0;
        }
    }else if(reason == "recover" || reason == "addnew" || reason == "change_today"){
        if($num_con.hasClass("all-finished")){
            $num_con.removeClass("all-finished");
        }

        $num_con.text(parseInt(today_tasks_num) + 1);
    }
}

// Strip HTML tags with a whitelist
function strip_tags(str, allowed_tags) {
 
    var key = '', allowed = false;
    var matches = [];
    var allowed_array = [];
    var allowed_tag = '';
    var i = 0;
    var k = '';
    var html = '';
 
    var replacer = function(search, replace, str) {
        return str.split(search).join(replace);
    };
 
    // Build allowes tags associative array
    if (allowed_tags) {
        allowed_array = allowed_tags.match(/([a-zA-Z]+)/gi);
    }
 
    str += '';
 
    // Match tags
    matches = str.match(/(<\/?[\S][^>]*>)/gi);
 
    // Go through all HTML tags
    for (key in matches) {
        if (isNaN(key)) {
            // IE7 Hack
            continue;
        }
 
        // Save HTML tag
        html = matches[key].toString();
 
        // Is tag not in allowed list? Remove from str!
        allowed = false;
 
        // Go through all allowed tags
        for (k in allowed_array) {
            // Init
            allowed_tag = allowed_array[k];
            i = -1;
 
            if (i != 0) { i = html.toLowerCase().indexOf('<'+allowed_tag+'>');}
            if (i != 0) { i = html.toLowerCase().indexOf('<'+allowed_tag+' ');}
            if (i != 0) { i = html.toLowerCase().indexOf('</'+allowed_tag)   ;}
 
            // Determine
            if (i == 0) {
                allowed = true;
                break;
            }
        }
 
        if (!allowed) {
            str = replacer(html, "", str); // Custom replace. No regexing
        }
    }
 
    return str;
}

function cache_tag_data(tag_id,data){
	var cache_tag_id = "_cache_tag_" + tag_id,
		tag_div = document.getElementById(cache_tag_id);

	//如果此标签未建立缓存
	if(!tag_div){
		var tag_div = document.createElement("div");
	}
	
	var results_cache = document.getElementById("results_cache");
	tag_div.innerHTML = data;
	tag_div.id = "_cache_tag_" + tag_id;
	jQuery(tag_div).data("tag_id",tag_id);
	results_cache.appendChild(tag_div);
}

function get_cached_tag_data(tag_id){
	var cache_tag_id = "_cache_tag_" + tag_id,
		tag_div = document.getElementById(cache_tag_id);

	if(tag_div){
		return tag_div.innerHTML;
	}
}

 function utf16to8(str) {  
    var out, i, len, c;  
    out = "";  
    len = str.length;  
    for(i = 0; i < len; i++) {  
    c = str.charCodeAt(i);  
    if ((c >= 0x0001) && (c <= 0x007F)) {  
        out += str.charAt(i);  
    } else if (c > 0x07FF) {  
        out += String.fromCharCode(0xE0 | ((c >> 12) & 0x0F));  
        out += String.fromCharCode(0x80 | ((c >>  6) & 0x3F));  
        out += String.fromCharCode(0x80 | ((c >>  0) & 0x3F));  
    } else {  
        out += String.fromCharCode(0xC0 | ((c >>  6) & 0x1F));  
        out += String.fromCharCode(0x80 | ((c >>  0) & 0x3F));  
    }  
    }  
    return out;  
}  

function insertTextAtCursor(el, text) {
    var val = el.value, endIndex, range;
    if (typeof el.selectionStart != "undefined" && typeof el.selectionEnd != "undefined") {
        endIndex = el.selectionEnd;
        el.value = val.slice(0, el.selectionStart) + text + val.slice(endIndex);
        el.selectionStart = el.selectionEnd = endIndex + text.length;
    } else if (typeof document.selection != "undefined" && typeof document.selection.createRange != "undefined") {
        el.focus();
        range = document.selection.createRange();
        range.collapse(false);
        range.text = text;
        range.select();
    }
}

function pasteHtmlAtCaret(html) {
    var sel, range;
    if (window.getSelection) {
        // IE9 and non-IE
        sel = window.getSelection();
        if (sel.getRangeAt && sel.rangeCount) {
            range = sel.getRangeAt(0);
            range.deleteContents();

            // Range.createContextualFragment() would be useful here but is
            // only relatively recently standardized and is not supported in
            // some browsers (IE9, for one)
            var el = document.createElement("div");
            el.innerHTML = html;
            var frag = document.createDocumentFragment(), node, lastNode;
            while ( (node = el.firstChild) ) {
                lastNode = frag.appendChild(node);
            }
            range.insertNode(frag);

            // Preserve the selection
            if (lastNode) {
                range = range.cloneRange();
                range.setStartAfter(lastNode);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }
    } else if (document.selection && document.selection.type != "Control") {
        // IE < 9
        document.selection.createRange().pasteHTML(html);
    }
}

function getSelectionHTML() {
	var userSelection;
	if (window.getSelection) {
		// W3C Ranges
		userSelection = window.getSelection ();
		// Get the range:
		if (userSelection.getRangeAt)
			var range = userSelection.getRangeAt (0);
		else {
			var range = document.createRange ();
			range.setStart (userSelection.anchorNode, userSelection.anchorOffset);
			range.setEnd (userSelection.focusNode, userSelection.focusOffset);
		}
		
		// And the HTML:
		var clonedSelection = range.cloneContents ();
		var div = document.createElement ('div');
		div.appendChild (clonedSelection);
		return div.innerHTML;
	} else if (document.selection) {
		// Explorer selection, return the HTML
		userSelection = document.selection.createRange ();
		return userSelection.htmlText;
	} else {
		return '';
	}
};

function getLastInput(el){
	if(!el) return false;
	if(window.getSelection){
		var sel = window.getSelection();
		var range = document.createRange();
		if(sel.anchorOffset > 0){
			range.setStart(sel.anchorNode,sel.anchorOffset - 1);
			range.setEnd(sel.anchorNode,sel.anchorOffset);
			return range.toString();
		}else{
			return false;
		}
	}else if(document.selection){
		var sel = document.selection;
		var range = document.body.createTextRange();
			range.moveToElementText(el);
			if(range.text.length > 0){
				range.setEndPoint("EndToEnd",sel);
				var endOffset = range.text.length;
				if(endOffset > 0){
					range.moveStart("character",endOffset-1);
					return range.text;
				}
			}
	}
}

function getCursorPosition(element) {
	if(!element) return false;
    var caretOffset = 0;
    var doc = element.ownerDocument || element.document;
    var win = doc.defaultView || doc.parentWindow;
    var sel;
    if (typeof win.getSelection != "undefined" && typeof win.getSelection().type != "undefined" && win.getSelection().type.toLowerCase() != "none") {
        var sel = win.getSelection();
        if(sel.type == "None") return false;
        var range = win.getSelection().getRangeAt(0);
        var preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        caretOffset = preCaretRange.toString().length;
    } else if ( (sel = doc.selection) && sel.type != "Control") {
        var textRange = sel.createRange();
        var preCaretTextRange = doc.body.createTextRange();
        preCaretTextRange.moveToElementText(element);
        preCaretTextRange.setEndPoint("EndToEnd", textRange);
        caretOffset = preCaretTextRange.text.length;
    }
    return caretOffset;
}

//从数据库中取得分享组件的顺序,
//如果有的话，则取出前六个为已经启用的分享组件，之后的为未启用的
function constructShareIcons(page,place){
    var shareUtils = {
        // 国外分享组件
        en : [{name: "facebook", id:4}, {name:"twitter",id:1}, {name:"plus",id:5}, {name:"tumblr",id:2}, {name:"gmail",id:12}, {name:"line",id:10}],

        // 国内分享组件
        zh : [{name:"qqim",id:13}, {name:"sinaweibo",id:3}, {name:"qqzone",id:7}, {name:"douban",id:8}, {name:"qqmail",id:11}, {name:"wechat",id:6}, {name:"tencent",id:9}]
    };

    var allShareUtils = {
        "1": {name: "twitter"},
        "2": {name: "tumblr"},
        "3": {name: "sinaweibo"},
        "4": {name: "facebook"},
        "5": {name: "plus"},
        "6": {name: "wechat"},
        "7": {name: "qqzone"},
        "8": {name: "douban"},
        "9": {name: "tencent"},
        "10": {name: "line"},
        "11": {name: "qqmail"},
        "12": {name: "gmail"},
        "13": {name: "qqim"}
    };

    var enabledUtils = [],
        disabledUtils = [];

    if(window._shareOrderStr){
        var orderArr = _shareOrderStr.split("|");

        for(var i=0,len=orderArr.length; i<len; i++){
            if(i < 6){
                enabledUtils.push(allShareUtils[orderArr[i]]);
            }else{
                disabledUtils.push(allShareUtils[orderArr[i]]);
            }
        }
    }else{
        //如果用户没有自定义分享组件，则按照浏览器界面语言来取分享组件
        if(navigator.language.toLowerCase().indexOf("zh") >= 0){
            //如果是中文地区
            enabledUtils = shareUtils.zh;
            disabledUtils = shareUtils.en;
        }else{
            //如果是非中文地区
            enabledUtils = shareUtils.en;
            disabledUtils = shareUtils.zh;
        }
    }

    var html = "";
    switch(page){
        // 得到设置页面的分享组件的html
        case "settings": 
            html += "<div class=\"show-icon\">";
            for(var i=0; i<6; i++){
                var shareUtil = enabledUtils[i];

                html += "<span class=\"item ok-icon-"+shareUtil.name+"\" data-id=\""+shareUtil.id+"\"></span>";
            }
            html += "</div>";

            for(var i=0,len=disabledUtils.length; i<len; i++){
                var disabledUtil = disabledUtils[i];

                html += "<span class=\"item ok-icon-"+disabledUtil.name+"\" data-id=\""+disabledUtil.id+"\"></span>";
            }

            if(place){
                //先删除
                $("section.share .inner-con .show-icon,section.share .inner-con .item").remove();
                
                //再将分享组件附上
                $("section.share .inner-con").append(html);
            }
            break;

        // 得到首页的分享组件的html
        case "homepage":
            for(var i=0; i<6; i++){
                var shareUtil = enabledUtils[i];

                html += "<div class=\"share-icon"+(i==0 ? " first" : (i == 5 ? " last" : ""))+"\">"+
                            "<div><a href=\"#\" class=\""+shareUtil.name+" component\">"+
                                "<span class=\"ok-icon-"+shareUtil.name+" icon-font\"></span></a>"+
                            "</div>"+
                        "</div>";
            }

            if(place){
                $("#note_ops .share.section .default").html(html);
            }
            break;

        //得到图片墙页面的分享组件的html
        case "imagewall":
            for(var i=0; i<6; i++){
                var shareUtil = enabledUtils[i];
                html += "<a href=\"#\" class=\"comp "+shareUtil.name+"\"><span class=\"icon-item ok-icon-"+shareUtil.name+"\"></span></a>";
            }

            html += "<a href=\"#\" class=\"unavailable comp more\"><span class=\"icon-item  ok-icon-arrowDropDown\"></span></a>";

            html += "<div class=\"more-comp\"><div class=\"other-icons\">";
            for(var i=0,len=6; i<len; i++){
                var disabledUtil = disabledUtils[i];

                html += "<a href=\"#\" class=\"comp "+disabledUtil.name+"\"><span class=\"icon-item ok-icon-"+disabledUtil.name+"\"></span></a>";
            }

            html += "</div></div>";

            if(place){
                $(".wall-header .share-con .comp,.wall-header .share-con .more-comp").remove();
                $(".wall-header .share-con").prepend(html);
            }
            break;
        case "image":
            for(var i=0; i<6; i++){
                var shareUtil = enabledUtils[i];

                html += "<div class=\"share-icon\"><a href=\"#\" class=\""+shareUtil.name+" component\"><span class=\"icon-font ok-icon-"+shareUtil.name+"\"></span></a></div>";
            }

            html += "<div class=\"share-icon\"><a href=\"#\" class=\"cancel-share\"><span class=\"icon-font ok-icon-share\"></span></a></div>";

            if(place){
                $(".wall-wrapper .item .share-component").html(html);
            }
            break;

        // 得到图片幻灯页面的分享组件的html
        case "lightbox":
            for(var i=0; i<6; i++){
                var shareUtil = enabledUtils[i];

                html += "<a href=\"#\" class=\""+shareUtil.name+"\"><span class=\"icon-item ok-icon-"+shareUtil.name+"\"></span></a>";
            }

            if(place){
                $("#lightbox .share-con a").each(function(){
                    if(!$(this).hasClass("ok-dl-img")){
                        $(this).remove();
                    }
                });

                $("#lightbox .share-con").prepend(html);
            }
            break;
        default: return "";
    };

    return html;

    //需要改的地方:js监听的类名称全部要改为数据库中的名称,并且要以on来监听
}

function refreshShareIcons(page){
    $(["homepage","settings","imagewall","image","lightbox"]).each(function(i,v){
        constructShareIcons(v,true);
    });
    
}

//type为rich或者plain
function process_sharetext(content,type){
    type = type ? type : "plain";

    if(type == "plain"){
        //纯文本分享，将所有html tag去除，将html实体去除如&nbsp;
        content = content.replace(/\&nbsp\;/," ");

        //先将<br>换成\n
        content = content.replace(/\<br[^<>]{0,}\>/,"\n");

        //去掉所有html标签
        content = content.replace(/(<([^>]+)>)/ig,"");

    }else if(type == "rich"){
        //以html的形式分享，将所有rel=image的a标签转换为图片标签，其余不变
        content = content.replace(/\<a[^><]{0,}href\=["']?([^'"><]+)["']?[^><]{0,}rel\=["']?image["']?[^><]{0,}\>([^><]{0,})(?:\<\/a\>)?/ig,"<img src=\"$1\" />");
    }
    
    return content;
}

//高亮搜索文字
function highlight_text(keyword,parentel,exclass){
    if(keyword == "") return false;
    exclass = !!exclass ? exclass : "kws-highlight";
    if(document.createRange){
        if(!parentel) parentel = document.body;
        var childs = parentel.childNodes;
        var ran_arr = [];

        for(var i=0,len=childs.length; i<len; i++){
             child = childs[i];
            
            if(child.childNodes.length > 0){
                highlight_text(keyword,child);
            }else{
                //在子节点中找关键字
                if(child.textContent){
                    var start = 0;

                    while(child.textContent.indexOf(keyword,start) >= 0 ){
                        var ran = document.createRange();

                        ran.setStart(child,child.textContent.indexOf(keyword,start));
                        ran.setEnd(child,child.textContent.indexOf(keyword,start)+keyword.length);
                                                    
                        start = child.textContent.indexOf(keyword,start)+keyword.length;
                        ran_arr.push(ran);
                    }
                }else if(child.innerText){
                    var start = 0;
                    while(child.innerText.indexOf(keyword,start) >= 0){
                        var ran = document.createRange();

                        ran.setStart(child,child.innerText.indexOf(keyword,start));
                        ran.setEnd(child,child.innerText.indexOf(keyword,start)+keyword.length);
                        start = child.innerText.indexOf(keyword,start)+keyword.length;
                        ran.surroundContents(b);
                    }
                }

            }
        }

         for(var j=0,len=ran_arr.length; j<len; j++){
            var range = ran_arr[j];
            var wrapper = document.createElement("span");
            wrapper.className = exclass;
            range.surroundContents(wrapper);
        }
    }else if(document.body.createTextRange){
        var ran = document.body.createTextRange();
        if(parentel) ran.moveToElmentText(parentel);
        while(ran.findText(keywords,1)){
            ran.pasteHTML("<span class=\""+exclass+"\">"+keywords+"</span>");
        }
    }
}

function gplus_share(share_url,extra){
    //https://twitter.com/intent/tweet?url=http://alistapart.com/article/designing-web-registration-forms-for-kids&text=Designing+Web+Registration+Processes+for+Kids&via=alistapart
    if(share_url.indexOf("?") == -1){
        share_url += "?__backsrc=gplus";
    }else{
        share_url += "&__backsrc=gplus";
    }

    var url = "https://plus.google.com/share?url="+encodeURIComponent(share_url)+extra;
    return url;
}

//qq及时通信分享
//url
//title
//summary会以灰字显示
//desc会显示在框框中
function qqim_share(content,img_url,share_url,title,site_title,extra){
    site_title = site_title ? site_title : document.title;
    var url = "http://connect.qq.com/widget/shareqq/index.html"+
            "?url="+encodeURIComponent(share_url)+
            "&showcount=1"+
            "&desc="+encodeURIComponent(content)+
            "&summary="+encodeURIComponent(content)+
            "&title="+encodeURIComponent(title)+
            "&site="+encodeURIComponent(site_title)+
            "&pics="+encodeURIComponent(img_url)+extra;
    return url;
}

function tumblr_share(content,pic_url,share_url,extra){
    if(share_url.indexOf("?") == -1){
        share_url += "?__backsrc=weibo";
    }else{
        share_url += "&__backsrc=weibo";
    }

    //是否有图片，有图片则以图片形式分享
    if(pic_url){
        var url = "https://www.tumblr.com/share/photo?source="+encodeURIComponent(pic_url)+"&caption="+encodeURIComponent(content)+extra;
    }else if(share_url){
        //没图片则分享链接
        var url = "https://www.tumblr.com/share/link?url="+encodeURIComponent(share_url)+"&name="+encodeURIComponent(get_title(content))+"&description="+encodeURIComponent(content)+extra;
    }else{
        var url = "https://www.tumblr.com/share/quote?quote="+encodeURIComponent(content)+"&source="+encodeURIComponent(location.href);
    }

    return url;
}

function fb_share(content,share_url,extra){
    //https://www.facebook.com/sharer/sharer.php?u=http%3A%2F%2Falistapart.com%2Farticle%2Fdesigning-web-registration-forms-for-kids&t=Designing+Web+Registration+Processes+for+Kids
    if(content.length > 140){
        content = content.substr(0,130)+"......";
    }

    if(share_url.indexOf("?") == -1){
        share_url += "?__backsrc=facebook";
    }else{
        share_url += "&__backsrc=facebook";
    }
    content = content.replace(" ","+");
    var url = "http:s//wwww.facebook/sharer/sharer.php?u="+share_url+"&t="+content+extra;
    return url
}

function twitter_share(content,share_url,twitter_name,extra){
    if(content.length > 140){
        content = content.substr(0,130)+"......";
    }

    if(share_url.indexOf("?") == -1){
        share_url += "?__backsrc=twitter";
    }else{
        share_url += "&__backsrc=twitter";
    }

    var url = "https://twitter.com/intent/tweet?url="+encodeURIComponent(share_url)+"&text="+encodeURIComponent(content)+"via="+twitter_name+extra;
    return url;
}


//各大分享组件
// 微博
// content: 分享框中得内容，不能超过140，超过的部分截掉用省略号代替
// pic_url: 分享框下面的图片，只能放一张
// share_url: 希望用户点击的网址
// extra: 额外的参数，以键值对的形式如：&key=value
function weibo_share(content,pic_url,share_url,extra){
	var newwin_height = 500,
        newwin_width = 800,
        newwin_top = (window.screen.height - newwin_height) / 2,
        newwin_left = (window.screen.width - newwin_width) / 2;
    
    if(content.length > 140){
        content = content.substr(0,130)+"......";
    }

    if(share_url.indexOf("?") == -1){
    	share_url += "?__backsrc=weibo";
    }else{
    	share_url += "&__backsrc=weibo";
    }

	var url = "http://service.weibo.com/share/share.php?pic="+encodeURIComponent(pic_url)+"&url="+encodeURIComponent(share_url)+"&title="+encodeURIComponent(content)+extra;
    return url;
}

// 豆瓣
// text: 长文
// image_url: 图片链接，单张
// title: 标题
// extra: 额外的参数，以键值对的形式如：&key=value
function douban_share(text,image_url,title,extra){
	var newwin_height = 500,
        newwin_width = 800,
        newwin_top = (window.screen.height - newwin_height) / 2,
        newwin_left = (window.screen.width - newwin_width) / 2;
    
    if(text.length > 140){
        text = text.substr(0,130)+"......";
    }

	var url = "http://www.douban.com/share/service?image="+encodeURIComponent(image_url)+"&name="+title+"&text="+text+extra;

    return url;
}

// qq邮箱
function qqmail_share(content,pic_url,title,share_url,site_title,extra){
	var newwin_height = 500,
        newwin_width = 800,
        newwin_top = (window.screen.height - newwin_height) / 2,
        newwin_left = (window.screen.width - newwin_width) / 2;

	var desc = "这是我从Ok记中看到的好东西，分享一下";

	site_title = site_title ? site_title : document.title;

	if(share_url.indexOf("?") == -1){
    	share_url += "?__backsrc=qqmail";
    }else{
    	share_url += "&__backsrc=qqmail";
    }
	
	var url = "http://mail.qq.com/cgi-bin/qm_share?url="+encodeURIComponent(share_url)+"&to=&pics="+encodeURIComponent(pic_url)+"&desc="+desc+"&summary="+encodeURIComponent(content)+"&title="+title+"&site="+document.title+extra;
	
    return url;
}

// Gmail
function gmail_share(content){
	var newwin_height = 500,
        newwin_width = 800,
        newwin_top = (window.screen.height - newwin_height) / 2,
        newwin_left = (window.screen.width - newwin_width) / 2;

	var url = "https://mail.google.com/mail/?ui=2&view=cm&fs=1&tf=1&su=&body="+encodeURIComponent(content)+"&shva=1&ov=0";
    return url;
}

// qq空间
function qzone_share(content,pic_urls,title,share_url,site_title,extra){
	var newwin_height = 500,
        newwin_width = 800,
        newwin_top = (window.screen.height - newwin_height) / 2,
        newwin_left = (window.screen.width - newwin_width) / 2;

	var desc = "这是我从Ok记中看到的好东西，分享一下";
	site_title = site_title ? site_title : document.title;
	title = title ? title : "分享自:Ok记";
	if($.isArray(pic_urls)){
		$.each(pic_urls,function(i,v,c){pic_urls[i] = encodeURIComponent(v);});
		pic_urls = pic_urls.join("|");
	}else{
		pic_urls = encodeURIComponent(pic_urls);
	}

	if(share_url.indexOf("?") == -1){
    	share_url += "?__backsrc=qzone";
    }else{
    	share_url += "&__backsrc=qzone";
    }
	var url = "http://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url="+encodeURIComponent(share_url)+"&pics="+pic_urls+"&title="+title+"&desc="+desc+"&summary="+encodeURIComponent(content)+"&site="+site_title+extra;
    return url;
}

// 腾讯微博
function qt_share(content,pic_url,share_url,extra){
	var newwin_height = 500,
        newwin_width = 800,
        newwin_top = (window.screen.height - newwin_height) / 2,
        newwin_left = (window.screen.width - newwin_width) / 2;

    if(content.length > 140){
        content = content.substr(0,130)+"......";
    }

    if(share_url.indexOf("?") == -1){
    	share_url += "?__backsrc=qt";
    }else{
    	share_url += "&__backsrc=qt";
    }

    var url = "http://share.v.t.qq.com/index.php?c=share&a=index&url="+encodeURIComponent(share_url)+"&pic="+encodeURIComponent(pic_url)+"&title="+encodeURIComponent(content)+extra;
    return url;
}

function onlyNumLetterWord(str){
	if(str.length > 100 || str.length == 0){
		return false;
	}

	if(/[\!\@\#\$\%\^\&\*\(\)\·\（\）\_\+\~\<\>\:\"\?\{\}\|\,\.\;\'\[\]\-\=\`\，\。\；\‘\：\“\《\》\|\\\、\”\"\】\【]/.test(str)){
		return false;
	}
	var schar = "",escaped = "";
	for(var i=0,len=str.length; i<len; i++){
		schar = str.substr(i,1);
		if(!/[a-z0-9\s]/i.test(schar)){
			if(!/^[\u4300-\u9FCC]$/.test(schar)){
				return false;
			}
		}
	}
	return true;
}

//弹出对话框
function popup_dialog(options){
    var $popup = $("#popup_dialog");
    if($popup.length == 0){
        var popup = "<div id=\"popup_dialog\">"+
                        "<div class=\"overlay\"></div>"+
                        "<div class=\"wrapper\">"+
                            "<div class=\"title-con\"><h1 class=\"title\">确认提示</h1></div>"+
                            "<div class=\"desc-con\"><div class=\"desc\">Good day there!</div></div>"+
                            "<div class=\"error\"></div>"+
                            "<div class=\"btns\"><a class=\"btn cancel\" href=\"#\">取消</a><a class=\"btn confirm\" href=\"#\">确认</a></div>"+
                            "<a href=\"#\" class=\"btn close\">x</a>"+
                        "</div>"+
                    "</div>"
        $("body").append(popup);

        //确认或者取消对话框
        $("#popup_dialog").on("click",".wrapper .btn,.overlay",function(event){
            event.preventDefault();

            if($(this).hasClass("cancel") || $(this).hasClass("close") || $(this).hasClass("overlay")){
                close_popup();
            }
        });
    }

    if(options){
        if(options.title) $("#popup_dialog .title").text(options.title);
        if(options.desc) $("#popup_dialog .desc").html(options.desc);
        if(options.cancelText) $("#popup_dialog .btn.cancel").text(options.cancelText);
        if(options.confirmText) $("#popup_dialog .btn.confirm").text(options.confirmText);
        if(options.classstr) $("#popup_dialog .wrapper").addClass(options.classstr);
        if(options.callback && $.isFunction(options.callback)){
            $("#popup_dialog .btn.confirm").on("click "+downEvent,options.callback);
        }
    }
    
    //展示
    $("#popup_dialog").addClass("active");
}

// function confirm_tag_deletion(tag_name,callback){
//     var delete_tag_html = "<div class=\"desc_s\">"+ (_translate("popup_del_tag_desc_s") || "相关贴纸也将移除此标签(贴纸不会被删除)。")+"</div><div class=\"delete-checking\">"+
//                             "<span class=\"checkbox\"><span class=\"ok-icon-checked\"></span></span>"+
//                             "<p>"+ (_translate("popup_del_tag_desc_p") || "将此TAG下贴纸移至")+"</p>"+
//                             "<ul class=\"tags-con\">"+
//                                 "<div class=\"current-state\"><a href=\"#\">垃圾桶</a><span class=\"ok-icon-option icon-font\"></span></div>"+
//                                 "<li class=\"items choosed\"><a href=\"#\" data-tags=\"\" class=\"\">垃圾桶</a></li>"+
//                                 "<li class=\"items\"><a href=\"#\" data-tags=\"\">美食节目</a></li>"+
//                                 "<li class=\"items\"><a href=\"#\" data-tags=\"\">前段时间</a></li>"+
//                                 "<li class=\"items\"><a href=\"#\" data-tags=\"\">你要三处么</a></li>"+
//                                 "<li class=\"items\"><a href=\"#\" data-tags=\"\">创建新TAG</a></li>"+
//                             "</ul>"+
//                         "</div>";

//      var title = "删除TAG";
//     var desc =  "<div class=\"desc_b\">"+ (_translate("popup_del_tag_desc",tag_name) || "确认删除\""+tag_name+"\"标签吗？")+"</div>"+delete_tag_html;
//     var classstr = "delete-tag";


//     popup_dialog({
//         title: title,
//         desc: desc,
//         classstr: classstr,
//         cancelText:  _translate("btn_cancel_del_tag") ||  "先不删",
//         confirmText: _translate("btn_confirm_del_tag") || "确认删除",
//         callback:callback
//     });
// }

function close_popup(){
    $("#popup_dialog").removeClass("active");
    //取消点击确认事件
    $("#popup_dialog .btn.confirm").off("click").off(downEvent);
    $("#popup_dialog .title").text("确认提示");
    $("#popup_dialog .desc").text("Good day there!");
    $("#popup_dialog .error").html("");
    $("#popup_dialog .btn.cancel").text("取消");
    $("#popup_dialog .btn.confirm").text("确定");
    $("#popup_dialog .wrapper").attr("class","wrapper").removeAttr("style");
}

function getDataSet(node){
	if(typeof DOMStringMap != "undefined" && node.dataset instanceof DOMStringMap){
			return node.dataset;
	}
	
	if(typeof DOMStringMap == "undefined"){
		if(node.tagName != "undefined"){
			var datas = node.outerHTML.match(/data\-[^\s]+=\"[^\s]+\"/g);
			if(datas === null){
				return null;
			}else{
				var dataset = {},prop = "",val = "";
				var len = datas.length;
				for(var i=0; i<len; i++){
					var str = datas[i];
					prop = str.slice(str.indexOf("-")+1,str.indexOf("="));
					val = str.slice(str.indexOf("=")+2,str.length-1);
					dataset[prop] = val;
				}
				return dataset;
			}
		}else{
			return null;
		}
	}
}

function src_from(str){
    var match = str.match(/\#srcin\=([_a-zA-Z0-9]+)/);
    if(match){
        return match[1];
    }else{
        return "";
    }
}

function showMessage(o){
    var typeclass = ["error","success","warning"];

    if(!o || o.msg === undefined || o.msg == ""){
        return false;
    }

    if(o.type){
        o.remove = typeclass.join(" ").replace(o.type,"");
    }else{
        o.remove = "";
    }

    if(window.Tracker){
        Tracker.sendEvent('Message',o.type+":"+o.msg);
    }

    jQuery("#message").html(o.msg).show();

    if(o.type !== undefined && typeof o.type == "string"){
        //让message div居中
        //得到left位置
        var divW = jQuery("#message").outerWidth();

        var left = divW/2;

        jQuery("#message").addClass(o.type).removeClass(o.remove).css({"left":"-"+left+"px"});

        //自动关闭
        if(o.autoclose){
            setTimeout(function(){
                restoreMsg();
            },1000);
            return ;
        }

        jQuery("#message").on("click.message",function(){
            restoreMsg();
        }).attr("title","").on("mouseover",function(){
            jQuery(this).addClass("hvr");
        }).on("mouseout",function(){
            jQuery(this).removeClass("hvr");
        });
    }
}

function restoreMsg(){
	jQuery("#message").removeAttr("class").removeAttr("title").removeAttr("style").text("").off("click.message");
}

function isEmptyObject(obj){
	var prop;
	for(prop in obj){
		return false;
	}
	return true;
}

function getCenterPos(self,parent){
	var pos = {left:0,top:0};
	if(!self || !parent){
		return false;
	}

	if(self.tagName == undefined || parent.tagName == undefined){
		return pos;
	}

	if(self.parentNode != parent){
		parent.appendChild(self);
	}

	pos.left = (jQuery(parent).width() - jQuery(self).outerWidth()) /2;
	
	if(jQuery(parent).height() < jQuery(self).height()){
		pos.top = -(jQuery(self).height() - jQuery(parent).height()) /2;
	}else{
		pos.top = (jQuery(parent).height() - jQuery(self).height()) /2;
	}
	return pos;
}

function checkUrl(link_url){
    if(link_url == "" || !link_url.match(/^(http\:\/\/|https\:\/\/|ftp\:\/\/)?([a-z0-9\-]+\.){0,5}[a-z0-9\-]+\.[a-z0-9]{1,5}(\/?|\/.+)+$/i) || link_url.length > 2048){
        return false;
    }else{
        if(link_url.indexOf('http') < 0){
            link_url = "http://"+link_url;
		}
        return link_url;
    }
}

function checkLinkUrl(link_url){
	if(link_url == ""){
		showMessage({type:"warning",msg:"链接不能为空"});
		return false;
	}
	link_url = jQuery.trim(link_url);
	if(!link_url.match(/^(http\:\/\/|https\:\/\/|ftp\:\/\/)?([a-z0-9\-]+\.){0,5}[a-z0-9\-]+\.[a-z]{1,5}(\/?|\/.+)+$/i)){
		showMessage({type:"warning",msg:"请输入合法网址"});
		return false;
	}

	if(link_url.length > 2048){
		showMessage({type:"warning",msg:"地址过长"});
		return false;
	}

	if(link_url.indexOf('http') < 0){
			link_url = "http://"+link_url;
	}

	return isUrlEncoded(link_url) ? link_url : encodeURI(link_url);
}

function strip_bonus(data){
    var matches;
    if(matches = data.match(/[^[{]{0,}([[{].+[}]]$)/)){
        data = matches[1];
    }
    return data;
}

function get_global_dates(datesarr){
    var dates = datesarr ? datesarr : new Array(),date,global_dates = new Array();
    if(dates.length > 0){
        for(var i=0; i<dates.length; i++){
            date = dates[i].split(" ")[0];
            date = date+" 00:00:00";
            date = new Date(date);
            if(isNaN(date.valueOf())){
            	// ipad 加上 00:00:00回出现invalid date
            	date = dates[i].split(" ")[0];
            	date = new Date(date);
            	global_dates.push(date.valueOf()-28800000);//28800000 == 3600 * 1000 * 8
            }else{
            	global_dates.push(date.valueOf());
            }
        }
    }
    
    return global_dates;
}

//设置需要下载链接的文件名
function get_filename(url){
	if(!!!url){
		return false;
	}

	//如果存在后缀
	if(url.match(/[^\/]+\.(?:png|jpg|jpeg|svg|bmp|gif|tiff)\b/i)){
		return url.match(/[^\/]+\.(?:png|jpg|jpeg|svg|bmp|gif|tiff)\b/i)[0];
	}else{
		if(url.match(/[^\/]+$/)) 
			return url.match(/[^\/]+$/)[0] + ".png";
		else 
			return url;
	}

	//如果不存在后缀，则将后缀一律设为png

}

//以一种显眼的小动画吸引用户注意
//@param: {operation:,node:,effect:"default"}
//operation: the operation the user is perform before this animation
//node: which node to animate as to attract user
//effect: which animation effect to use
function notify_user(){

}

//检测链接是否为图片链接

//检测链接是否为图片链接
function is_image_url(url,callback,context){
    if(!!!url) return false;
    
    if($("iframe#testImg").length > 0){
        $("iframe#testImg").get(0).contentWindow.document.body.innerHTML += "<img src=\""+url+"\">";
    }else{
        var fr = document.createElement("iframe");
        fr.id = "testImg";
        fr.width = 0;
        fr.height = 0;
        fr.style.height = "0px";
        fr.style.width = "0px";
        document.body.appendChild(fr);
        fr.contentWindow.document.body.innerHTML += "<img src=\""+url+"\">";
    }

    try{
        var img = new Image();
        context = context ? context : img;
        //如果链接明显是指向的图片
        //svg格式的图片按照容器的大小来展示
        if($.isFunction(callback)){
            img.onerror = function(){callback.call(context,url,false);};
            img.onload = function(){callback.call(context,url,img);}
        }
        img.src = url;
    }catch(e){
        console.log(e.message);
    }
    
}

function get_json_feedback(data){
    if(!!!data){
        return false;
    }
    var odata = strip_bonus(data);
    return $.parseJSON(odata)
}

function get_current_time(){
	var current_date = new Date(),
		month = parseInt(current_date.getMonth()+1) < 10 ? "0" + parseInt(current_date.getMonth()+1) : parseInt(current_date.getMonth()+1),
		day = parseInt(current_date.getDate()) < 10 ? "0" + parseInt(current_date.getDate()) : parseInt(current_date.getDate()),
		hour = parseInt(current_date.getHours()) < 10 ? "0" + parseInt(current_date.getHours()) : parseInt(current_date.getHours()),
		minutes = parseInt(current_date.getMinutes()) < 10 ? "0" + parseInt(current_date.getMinutes()) : parseInt(current_date.getMinutes()),
		seconds = parseInt(current_date.getSeconds()) < 10 ? "0" + parseInt(current_date.getSeconds()) : parseInt(current_date.getSeconds()),
	current_date = current_date.getFullYear()+"-"+month+"-"+day+" "+hour+":"+minutes+":"+seconds;
	return current_date;
}

function get_formated_time(date,rttime){
	var rttime = !!rttime ? true : false;
	if((typeof date).toLowerCase() == "object"){
		var current_date = date;
	}else{
		var current_date = new Date(date);
	}
	var month = parseInt(current_date.getMonth()+1) < 10 ? "0" + parseInt(current_date.getMonth()+1) : parseInt(current_date.getMonth()+1),
		day = parseInt(current_date.getDate()) < 10 ? "0" + parseInt(current_date.getDate()) : parseInt(current_date.getDate()),
		hour = parseInt(current_date.getHours()) < 10 ? "0" + parseInt(current_date.getHours()) : parseInt(current_date.getHours()),
		minutes = parseInt(current_date.getMinutes()) < 10 ? "0" + parseInt(current_date.getMinutes()) : parseInt(current_date.getMinutes()),
		seconds = parseInt(current_date.getSeconds()) < 10 ? "0" + parseInt(current_date.getSeconds()) : parseInt(current_date.getSeconds());
	if(rttime){
		current_date = current_date.getFullYear()+"-"+month+"-"+day+" "+hour+":"+minutes+":"+seconds;
	}else{
		current_date = current_date.getFullYear()+"-"+month+"-"+day;
	}
	
	return current_date;
}

//处理要展示的时间字符串
function format_date_text(date_text){
	if(!date_text || !!!new Date(date_text)){
		return false;
	}

	var date = new Date(date_text);
	var year = date.getFullYear();
	var month = date.getMonth() + 1;
	var day = date.getDate();
	return year+"."+month+"."+day;
}

function get_pushable_bookmarks(bookmarks){
	var default_pushable_bookmarks = [{"title":"百度一下，你就知道","link":"http://www.baidu.com","start_date":null,"end_date":null,"remark":"百度一下，你就知道"}];
	var bookmark = null,
		start_date=null,
		end_date=null,
		todays_push=new Array(),
		current_date = new Date(),
		current_date = current_date.getFullYear()+"-"+parseInt(current_date.getMonth()+1)+"-"+current_date.getDate()+" 00:00:00",
		current_date_value = new Date(current_date).valueOf(),
		start_date_value=end_date_value="";
	if(jQuery.isArray(bookmarks) && bookmarks.length > 0){
		//get all the bookmarks available for today
		for(var i=0; i<bookmarks.length; i++){
			bookmark = bookmarks[i];
			start_date = bookmark.start_date;
			end_date = bookmark.end_date;
			if(start_date == null || end_date == null){
				todays_push.push(bookmark);
			}else{
				start_date_value = new Date(start_date).valueOf();
				end_date_value = new Date(end_date).valueOf();
				if(start_date_value < current_date_value && end_date_value > current_date_value){
					todays_push.push(bookmark);
				}
			}
			
		}
		return todays_push;
	}else{
		return default_pushable_bookmarks;
	}
}

//this function will return an array of links
function get_links(text){
	var links = text.match(/((http\:\/\/|https\:\/\/|ftp\:\/\/)?([a-z0-9\-]+\.){0,5}[a-z0-9\-]+\.(com|cn|hr|com\.cn|io|org|fr|jp|tv|name|mobi|us|fm|asia|net|gov|tel|la|travel|so|biz|info|hk|me|co|in|at|bz|ag|eu|in)[^\s\,\"\'\{\}\<]{0,})/ig);
        
    var validLinks = new Array();
	if(!!links){
		for(var i=0; i<links.length;i++){
            if(links[i].indexOf("...") < 0){
				if(links[i].indexOf("http://") < 0 && links[i].indexOf("https://") < 0){
					links[i] = "http://"+links[i];
				}
				validLinks.push(links[i]);
            }
		}
	}
        return validLinks;
}

function selectText(container) {
    if(!container) return false;
    if (document.selection) {
        document.selection.clear();
        var range = document.body.createTextRange();
        range.moveToElementText(container);
        range.select();
    } else if (window.getSelection) {
        var range = document.createRange();
        
        if(container){
            window.getSelection().removeAllRanges();
            range.selectNode(container);
            if(range){
                window.getSelection().addRange(range);
                window.getSelection().toString();
            } 
        }
    }
}

function clearSelection() {
    if (window.getSelection) {
        window.getSelection().removeAllRanges();
    } else if (document.selection) {
        document.selection.empty();
    }
}

//非任务无需顺序
function update_display_order(){
	$("#search_results.results-of-tasks .note-con").each(function(){
        var new_order = $(this).index();
        $(this).attr("data-order",new_order).data("order",new_order);
    });
}

function isUrlEncoded(link){
	var tmp = link;
	while(decodeURI(tmp) != tmp){
		tmp = decodeURI(tmp);
	}
	return (encodeURI(tmp) == link); 
}

function show_waitting(area){
    area = area ? area : document.body;
    
    var areaWidth = area.offsetWidth;
    var areaHeight = area.offsetHeight;
    var top = 0;
    if(area == document.body){
        areaWidth = jQuery(window).width();
        areaHeight = jQuery(window).height();
        top = jQuery("body").scrollTop();
    }
    
    area.style.overflow = "hidden";
    jQuery(area).addClass("waitting");
    jQuery(area).append("<div class='waitting-layer' style='width:"+areaWidth+"px;top:"+top+"px;height:"+areaHeight+"px'></div>");
}

function remove_waitting(area){
    area = area ? area : jQuery(".waitting")[0];
    area.style.overflow = "auto";
    jQuery(area).removeClass("waitting");
    jQuery(".waitting-layer",area).remove();
}

//处理写入便签的内容，去除一些html标记，留下一些标记如a标记，u,i,b标记，div转br标记,将多行空白转换为一行
function encode_content(content){
    //去除源代码中俩标签之间空格
    content = content.replace(/\>\s+\</ig,function(match){
        return match.replace(/\s+/,'');
    });
    
    //将图片转化
    content = content.replace(/\<img[^><]{0,}src\=["']?([^'"><]+)["']?[^><]{0,}\>/ig,function(match){
        if(match.match(/\<img[^><]{0,}alt\=["']?([^'"><]+)["']?[^><]{0,}\>/ig) || match.match(/\<img[^><]{0,}title\=["']?([^'"><]+)["']?[^><]{0,}\>/ig)){
            //得到图片标题或者替代文字
            var title = "";
            var alt_match = match.match(/\<img[^><]{0,}alt\=["']?([^'"><]+)["']?[^><]{0,}\>/i);
            var title_match = match.match(/\<img[^><]{0,}title\=["']?([^'"><]+)["']?[^><]{0,}\>/i);

            if(alt_match && alt_match.length > 1){
                title += alt_match[1];
            }

            if(title_match && title_match.length > 1){
                title += title_match[1];
            }

            return match.replace(/\<img[^><]{0,}src\=["']?([^'"><]+)["']?[^><]{0,}\>/ig,"[img]$1[/img]"+title);
        }else{
            return match.replace(/\<img[^><]{0,}src\=["']?([^'"><]+)["']?[^><]{0,}\>/ig,"[img]$1[/img]");
        }
    });

    //  /\<a[^><]{0,}     href\=["']?([^'"><]+)["']?   [^><]{0,}    rel\=["']?([^<>"']+)["']?   [^><]{0,}\>   ([^><]{0,})(?:\<\/a\>)?/ig

    //如果匹配到rel属性，则保留
    if(content.match(/\<a[^><]{0,}href\=["']?([^'"><]+)["']?[^><]{0,}rel\=["']?image["']?[^><]{0,}\>([^><]{0,})(?:\<\/a\>)?/ig)){
        content = content.replace(/\<a[^><]{0,}href\=["']?([^'"><]+)["']?[^><]{0,}rel\=["']?image["']?[^><]{0,}\>([^><]{0,})(?:\<\/a\>)?/ig,"[a href=\"$1\" rel=\"image\"]$2[/a]");
    }

    //超链接则变为将超链接隐藏在文字下面的链接如 <a href="http://www.baidu.com">百度一下，你就知道</a>
    content = content.replace(/\<a[^><]{0,}href\=["']?([^'"><]+)["']?[^><]{0,}\>([^><]{0,})(?:\<\/a\>)?/ig,"[a href=\"$1\"]$2[/a]");

    //将块级元素以换行代替，并且不对<br>标签进行处理
    content = content.replace(/\<div[^\>]{0,}\>\<\/div\>/ig,"[br]");
    content = content.replace(/\<br\>/ig,"[br]");

    //保留u标签
    content = content.replace(/\<u\b[^\>]{0,}\>/ig,"[u]");
    content = content.replace(/\<\/u\>/ig,"[/u]");

    //保留i标签
    content = content.replace(/\<i\b[^\>]{0,}\>/ig,"[i]");
    content = content.replace(/\<\/i\>/ig,"[/i]");

    //保留b标签
    content = content.replace(/\<b\b[^\>]{0,}\>/ig,"[b]");
    content = content.replace(/\<\/b\>/ig,"[/b]");

    //将div包起来的内容用前面附上br换行
    content = content.replace(/\<div\>/ig,"[br]");
    content = content.replace(/\<p\>/ig,"[br]");

    //去掉所有html标签
    content = content.replace(/(<([^>]+)>)/ig,"");

    //将多个换行变为一个
    //content = content.replace(/(\[br\])+/ig,"[br]");

    //去掉开头的br
    content = content.replace(/^(\[br\])/i,"");

    //还原换行
    content = content.replace(/\[br\]/ig,"<br>");

    //还原格式
    content = content.replace(/\[u\]/ig,"<u>");
    content = content.replace(/\[\/u\]/ig,"</u>");

    //还原格式
    content = content.replace(/\[i\]/ig,"<i>");
    content = content.replace(/\[\/i\]/ig,"</i>");

    //还原格式
    content = content.replace(/\[b\]/ig,"<b>");
    content = content.replace(/\[\/b\]/ig,"</b>");

    //还原图片标签，并将其转换为a标签
    content = content.replace(/\[img\]([^\[\]]+)\[\/img\]/ig,"<a href=\"$1\" rel=\"image\" contenteditable=\"false\">$1</a>");

    //还原a标签
    //还原非图片的链接标签
    content = content.replace(/\[a[^\]\[]{0,}href\=["']?([^'"\]\[]+)["']?[^\]\[]{0,}\]([^\]\[]{0,})(?:\[\/a\])?/ig,function(match){
        if(match.match(/\[a[^\]\[]{0,}href\=["']?([^'"\]\[]+)["']?[^\]\[]{0,}rel\=["']?image["']?[^\]\[]{0,}\]([^\]\[]{0,})(?:\[\/a\])?/ig)){
            return match.replace(/\[a[^\]\[]{0,}href\=["']?([^'"\]\[]+)["']?[^\]\[]{0,}rel\=["']?image["']?[^\]\[]{0,}\]([^\]\[]{0,})(?:\[\/a\])?/ig,"<a href=\"$1\" contenteditable=\"false\" rel=\"image\">$2</a>");
        }else{
            return match.replace(/\[a[^\]\[]{0,}href\=["']?([^'"\]\[]+)["']?[^\]\[]{0,}\]([^\]\[]{0,})(?:\[\/a\])?/ig,"<a href=\"$1\">$2</a>");
        }
    });
    
    return content;
}

//将图片和文字全部转化为链接再展示出来
function decode_content(content,isNew){
    var gl_fav = "http://www.google.com/s2/favicons?domain=";
    if($("body").hasClass("inside-parent")){
        var loc_origin = parent.location.origin;
    }else{
        var loc_origin = location.origin;
    }

    //如果favicon设置是打开状态，则在所有网址中添加favicon
    if($("body").hasClass("favicon_on")){
        if(isNew){
            //如果是新添加的急需展示的，则直接让其展示favicon，而不用滚动加载
            //在链接中添加图片图片节点
            content = content.replace(/\<a[^><]{0,}href\=["']?([^'"><]+)["']?[^><]{0,}\>([^><]{0,})(?:\<\/a\>)?/ig,function(match,url,title,offset,string){
                if(match.match(/\<a[^><]{0,}href\=["']?([^'"><]+)["']?[^><]{0,}rel\=["']?image["']?[^><]{0,}\>([^><]{0,})(?:\<\/a\>)?/)){
                    return match.replace(/\<a[^><]{0,}href\=["']?([^'"><]+)["']?[^><]{0,}rel\=["']?image["']?[^><]{0,}\>([^><]{0,})(?:\<\/a\>)?/ig,"<a class=\"open type-image\" data-lightbox=\"in-memo\" href=\"$1\" rel=\"image\"><img class=\"favicon\" onerror=\"favi_load_error(this)\" onabort=\"favi_loaded(this)\" height=\"12\" style=\"padding-bottom:1px;\" src=\""+gl_fav+"$1\" />$2</a>");
                }else{
                    return match.replace(/\<a[^><]{0,}href\=["']?([^'"><]+)["']?[^><]{0,}\>([^><]{0,})(?:\<\/a\>)?/ig,"<a class=\"open\" href=\""+loc_origin+"/#$1\" rel=\"link\"><img class=\"favicon\" onerror=\"favi_load_error(this)\" onabort=\"favi_loaded(this)\" height=\"12\" style=\"padding-bottom:1px;\" src=\""+gl_fav+"$1\" />$2</a>");
                }
            });
        }else{
            content = content.replace(/\<a[^><]{0,}href\=["']?([^'"><]+)["']?[^><]{0,}\>([^><]{0,})(?:\<\/a\>)?/ig,function(match,url,title,offset,string){
                if(match.match(/\<a[^><]{0,}href\=["']?([^'"><]+)["']?[^><]{0,}rel\=["']?image["']?[^><]{0,}\>([^><]{0,})(?:\<\/a\>)?/)){
                    return match.replace(/\<a[^><]{0,}href\=["']?([^'"><]+)["']?[^><]{0,}rel\=["']?image["']?[^><]{0,}\>([^><]{0,})(?:\<\/a\>)?/ig,"<a class=\"open type-image\" data-lightbox=\"in-memo\" href=\"$1\" rel=\"image\"><img class=\"favicon unloaded\" onerror=\"favi_load_error(this)\" onabort=\"favi_loaded(this)\" height=\"12\" style=\"padding-bottom:1px;\" data-src=\""+gl_fav+"$1\" />$2</a>");
                }else{
                    return match.replace(/\<a[^><]{0,}href\=["']?([^'"><]+)["']?[^><]{0,}\>([^><]{0,})(?:\<\/a\>)?/ig,"<a class=\"open\" href=\""+loc_origin+"/#$1\" rel=\"link\"><img class=\"favicon unloaded\" onerror=\"favi_load_error(this)\" onabort=\"favi_loaded(this)\" height=\"12\" style=\"padding-bottom:1px;\" data-src=\""+gl_fav+"$1\" />$2</a>");
                }
            });
        }
    }else{
        content = content.replace(/\<a[^><]{0,}href\=["']?([^'"><]+)["']?[^><]{0,}\>([^><]{0,})(?:\<\/a\>)?/ig,function(match,url,title,offset,string){
            if(match.match(/\<a[^><]{0,}href\=["']?([^'"><]+)["']?[^><]{0,}rel\=["']?image["']?[^><]{0,}\>([^><]{0,})(?:\<\/a\>)?/)){
                return match.replace(/\<a[^><]{0,}href\=["']?([^'"><]+)["']?[^><]{0,}rel\=["']?image["']?[^><]{0,}\>([^><]{0,})(?:\<\/a\>)?/ig,"<a class=\"open type-image\" data-lightbox=\"in-memo\" href=\"$1\" rel=\"image\">$2</a>");
            }else{
                return match.replace(/\<a[^><]{0,}href\=["']?([^'"><]+)["']?[^><]{0,}\>([^><]{0,})(?:\<\/a\>)?/ig,"<a class=\"open\" href=\""+loc_origin+"/#$1\" rel=\"link\">$2</a>");
            }
        });
    }

    content = content.replace(/\&amp\;/gi,"\&");

    //若是网址的话则变成链接
    content = content.replace(link_regexp,function(match,whole,scheme,rou,offset,string){
        if(match && match.indexOf(loc_origin) < 0 && match.indexOf(gl_fav) < 0){

            //只有是纯文本才给上链接，已经被标签包住的链接不再给其加上a标签
            if(string[offset-1] == ">" || string[offset+match.length] == "<"){
                if(string.substr(offset+match.length,4).indexOf('</a>') >= 0) return match;
            }
                
            //如果链接前面是本站附加的地址，也直接返回
            if(string.substr(offset-2-loc_origin.length,loc_origin.length) == loc_origin) return match;
            // if(string[offset-1] == "#" && string[offset-1-loc_origin.length]) 

            //如果链接是被转义过的链接，也直接返回
            if(string.substr(offset,2).toLowerCase() == "2f" && string.substr(offset-1,1) == "%" ) return match;


            //如果是href，也直接返回
            if(string.substr(offset-7,7).indexOf("href") >= 0) return match;

            //如果是链接中的链接，也直接返回
            return "<a class=\"open\" href=\""+loc_origin+"#"+match+"\">"+match+"</a>";
        }
        return match;
    });

    content = content.replace(ip_link_regexp,function(match,whole,scheme,offset,string){
        if(match && match.indexOf(loc_origin) < 0 && match.indexOf(gl_fav) < 0){
            if(string[offset-1] == ">" || string[offset+match.length] == "<"){
                if(string.substr(offset+match.length,4).indexOf('</a>') >= 0) return match;
            }

            //如果链接前面是本站附加的地址，也直接返回
            if(string.substr(offset-2-loc_origin.length,loc_origin.length) == loc_origin) return match;

            //如果链接是被转义过的链接，也直接返回
            if(string.substr(offset,2).toLowerCase() == "2f" && string.substr(offset-1,1) == "%" ) return match;

            //如果是href，也直接返回
            if(string.substr(offset-7,7).indexOf("href") >= 0) return match;

            //如果是链接中的链接，也直接返回

            return "<a class=\"open\" href=\""+loc_origin+"#"+match+"\">"+match+"</a>";
        }
        return match;
    });
    
    //去掉实体空格
    content = content.replace(/\&nbsp\;/ig," ");

    return content;
}

function favi_loaded(img){
	$(img).removeClass("unloaded");
}

function favi_load_error(img){
	//favicon加载错误,用站内一般图标代替
   	img.src = "layout/images/favicons.png";
}

function recount_in_tag(reason){
    if(reason != "delete" && reason != "addnew") return false;
    var curnum = 0,$numcon = $("#search_results h2 span.num");
    if(/\((\d+)\)/.test($numcon.text())){
        curnum = parseInt($numcon.text().match(/\((\d+)\)/)[1]);
        if(isNaN(curnum)) return false;
    }

    switch(reason){
        case "delete":
        $numcon.text("("+(curnum-1)+")");
        break;
        case "addnew":
        $numcon.text("("+(curnum+1)+")");
        break;
        default: return false;
    }
}

function view_hidden(contentdiv){
    if(contentdiv){
        contentdiv.style.height = ($(contentdiv).prop("scrollHeight")) + "px";

        if(contentdiv.offsetHeight < contentdiv.scrollHeight || $(contentdiv).closest(".note-con").hasClass("overflowed")){
            $(contentdiv).closest(".note-con").removeClass("overflowed");
        }
    }
}

function configure_height(contentdiv){
    if(contentdiv){
        contentdiv.style.height = 0;
        contentdiv.style.height = (Math.min($(contentdiv).prop("scrollHeight"),150)) + "px";

        //如果高度超过150
        if(contentdiv.offsetHeight < contentdiv.scrollHeight){
            $(contentdiv).closest(".note-con").addClass("overflowed");
        }
    }
}

function write_mode(contentdiv){
    //变为可编辑模式
    if($(contentdiv).attr("contenteditable") == "false" || $(contentdiv).attr("contenteditable") == undefined){
        $(contentdiv).attr("contenteditable",true);

        if($(contentdiv).data("value") === undefined){
            var content = encode_content($(contentdiv).html());
            $(contentdiv).data("value",content);
        }

        //回到纯文本状态，并对文本进行一些处理
        $(contentdiv).html($(contentdiv).data("value"));
    }
}

function read_mode(contentdiv){
	//变为不可编辑模式
	if($(contentdiv).attr("contenteditable") == "true" || $(contentdiv).attr("contenteditable") == ""){
		$(contentdiv).attr("contenteditable",false);
		//回到富文本状态
    	$(contentdiv).html(decode_content(contentdiv.innerHTML,true));
	}
}

function highlight_colored_tags(note_con){
	//给拥有默认标签的便签加上带颜色的假边框
    return false;
    if(!note_con){
	    $(".note-con.has-colored").each(function(){
	        if(!$(this).hasClass("highlighted")){
	            var $form = $("form",this),
	            	$tag_divs = $(".default_tag",this),
	            	cube_length = $tag_divs.length,
	            	cube_height = 1/cube_length * 100,
	            	i=0;

	            $tag_divs.each(function(){
	                this.style.top = i * cube_height + "%";
	                this.style.height = cube_height+"%";
	                i++;
	            });

	            $(this).addClass("highlighted");
	        }
	    });
	}else{
		if(!$(note_con).hasClass("highlighted")){
            var $form = $("form",note_con),
            	$tag_divs = $(".default_tag",note_con),
            	cube_length = $tag_divs.length,
            	cube_height = 1/cube_length * 100,
            	i=0;

            $tag_divs.each(function(){
                this.style.top = i * cube_height + "%";
                this.style.height = cube_height + "%";
                i++;
            });

            $(note_con).addClass("highlighted");
        }
	}
}

function toggleHvr(reset,selector,hvrclass,tpSeletor,callback){
	//tpSeletor => selector of target's parent
    if($.isFunction(reset)){
        reset();
    }
    hvrclass = hvrclass ? hvrclass : "hvr";
    
    if(!!!tpSeletor){
    	jQuery(document).on("mouseover",selector,function(){
	        jQuery(this).addClass(hvrclass);
	    });
	    jQuery(document).on("mouseout",selector,function(){
	        jQuery(this).removeClass(hvrclass);
	        if(callback && $.isFunction(callback)){
	    		callback.call(this);
	    	}
	    });
    }else{
    	jQuery(document).on("mouseover",selector,function(){
	        jQuery(this).parentsUntil(tpSeletor).last().addClass(hvrclass);
	    });

	    jQuery(document).on("mouseout",selector,function(){
	        jQuery(this).parentsUntil(tpSeletor).last().removeClass(hvrclass);
	        if(callback && $.isFunction(callback)){
	    		callback.call(this);
	    	}
	    });
    }
    
}

function toggleFocus(reset,selector,focusClass,containerselector,callback){

    focusClass = focusClass ? focusClass : "focus";
    //parentClass : which element this focusClass will be added to
    if(containerselector){
    	 jQuery(document).on("focus",selector,function(event){
    	 	if($.isFunction(callback)){
    	 		callback.call(this,event);	
    	 	}
    	 	
            jQuery(this).parentsUntil(containerselector).last().addClass(focusClass);
        });

        jQuery(document).on("blur",selector,function(event){
            jQuery(this).parentsUntil(containerselector).last().removeClass(focusClass);
            if($.isFunction(reset)){
		        reset.call(this,event);
		    }
        });
    }else{
    	jQuery(document).on("focus",selector,function(event){
    		if($.isFunction(callback)){
    	 		callback.call(this,event);	
    	 	}
            jQuery(this).addClass(focusClass);
        });

        jQuery(document).on("blur",selector,function(event){
            jQuery(this).removeClass(focusClass);
            if($.isFunction(reset)){
		        reset.call(this,event);
		    }
        });
    }
}

function is_retina_display() {
    if (window.matchMedia) {
        var mq = window.matchMedia("only screen and (min--moz-device-pixel-ratio: 1.3), only screen and (-o-min-device-pixel-ratio: 2.6/2), only screen and (-webkit-min-device-pixel-ratio: 1.3), only screen  and (min-device-pixel-ratio: 1.3), only screen and (min-resolution: 1.3dppx)");
        if (mq && mq.matches || (window.devicePixelRatio > 1)) {
            return true;
        } else {
            return false;
        }
    }
}

function toggleClassOn(eventstr,selectors,callbefore,callback,beforeClass,afterClass){
	eventstr = eventstr || "";
	selectors = selectors || "";
	callbefore = callbefore || null;
	callback = callback || null;
	beforeClass = beforeClass || "";
	afterClass = afterClass || eventstr;

	if(eventstr == "" || selectors == ""){
		if(console) console.error("no event or selector specified");
		return false;
	}

    var eventRef = {
    "blur":"focus",
    "focus":"blur",
    "mouseover":"mouseout",
    "mouseout":"mouseover",
    "mouseup":"mousedown",
    "mousedown":"mouseup"
    };
    jQuery(document).on(eventstr,selectors,function(event){
        if($.isFunction(callbefore)){
            callbefore.call(this,event);
        }
        jQuery(this).addClass(afterClass).removeClass(beforeClass);
    });
    
    if(eventstr != "click"){
    	jQuery(document).on(eventRef[eventstr],selectors,function(event){
	    	if($.isFunction(callback)){
	            callback.call(this,event);
	        }
    	    jQuery(this).removeClass(afterClass).addClass(beforeClass);
    	});
    }
}

function toggleClick(selectors,clickclass,preventDefault,callbefore,callback){

	jQuery(document).on("click touchstart",selectors,function(event){
		event = EventUtil.getEvent(event);
		if(preventDefault){
			EventUtil.preventDefault(event);
		}

		if(jQuery(this).hasClass(clickclass)){
			if(jQuery.isFunction(callbefore)){
				callbefore.call(this,event);
			}
			jQuery(this).removeClass(clickclass)
		}else{
			if(jQuery.isFunction(callback)){
				callback.call(this,event);
			}
			jQuery(this).addClass(clickclass)
		}
	});
}

/*
 * @param: 
 * content: the html inside modal-content
 * width: width of modal 
 */
function showModal(content,width,exclass){
    width = width ? width : 500;
    if(!jQuery("body").hasClass("overlayed")){
        jQuery("body").addClass("overlayed");
        jQuery(".modal").show();
        if(width){
            jQuery(".modal-content").css("width",width+"px");
        }
        jQuery(".modal-content").append(content);
        if(exclass){
            jQuery(".modal-content").addClass(exclass);
        }
        jQuery("#bulk_text").focus();
    }
}

//验证时间格式
function validate_date(value){
	if(!!value){
		return /\d{0,4}\-[01]?[0-9]\-[0-3]?[0-9](\s[0-2]?[0-9]\:[0-5][0-9]:[0-5]?[0-9])?/.test(value);
	}
}

function removeModal(){
    if(jQuery("body").hasClass("overlayed")){
        jQuery("body").removeClass("overlayed");
        jQuery(".modal").hide();
        jQuery(".modal-content").html("");
    }
}

function get_title(content){
	var title = "";
	//第一句话为标题
    //以一个标点符号作为一句的结束
    if(content.match(/^[^\,\.\;\'\"\，\。\、\；\’\”]+/)){
        title = content.match(/^[^\,\.\;\'\"\，\。\、\；\’\”]+/)[0];
    }
    //或者内容的前20个左右的字符
    title = content.substr(0,20);
    return title;
}

var EventUtil = {
	addHandler: function(el, type, handler) {
		if (el.addEventListener) {
			el.addEventListener(type, handler, false)
		} else if (el.attachEvent) {
			el.attachEvent("on" + type, handler);
		} else {
			el["on" + type] = handler;
		}
	},

	getEvent: function(evt) {
		return evt?evt:window.event;
	},

	getTarget: function(evt) {
		return evt.target?evt.target:evt.srcElement;
	},

	preventDefault: function(evt) {
		if (evt.preventDefault) {
			evt.preventDefault();
		} else {
			evt.returnValue = false;
		}
	},

	removeHandler: function(el, type, handler) {
		if (el.removeEventListener) {
			el.removeEventListener(type, handler, false);
		} else if (el.detachEvent) {
			el.detachEvent("on" + type, handler);
		} else {
			el["on" + type] = null;
		}
	},

	stopPropagation: function(evt) {
		if (evt.stopPropagation) {
			evt.stopPropagation();
		} else {
			evt.cancelBuble = true;
		}
	},

	getRelatedTarget: function(evt) {
		if (evt.relatedTarget) {
			return evt.relatedTarget;
		} else if (evt.toElement) {
			return evt.toElement;
		} else if (evt.fromElement){
			return evt.fromElement;
		} else {
			return null;
		}
	},

	getButton: function(evt) {
		if (document.implementation.hasFeature("MouseEvents","2.0")) {
			return evt.button;
		} else {
			switch (evt.button) {
				case 0:
				case 1:
				case 3:
				case 5:
				case 7:
					return 0;
				case 2:
				case 6:
					return 2;
				case 4:
					return 1;
			}
		}
	},

	getWheelDelta: function(evt) {
		if (evt.wheelDelta) {
			//to be continue ...
		} else {
			return -evt.detail * 40;
		}
	},

	getCharCode: function(evt) {
		if (typeof evt.charCode == "number") {
			return evt.charCode;
		} else {
			return evt.keyCode;
		}
	},

	getClipboardText: function(evt){
		var clipboardData = (evt.clipboardData || window.clipboardData);
		return clipboardData.getData("text");
	},

	setClipboardText: function(evt,value){
		if(evt.clipboardData){
			return evt.clipboardData.setData("text/plain",value);
		}else if(window.clipboardData){
			return window.clipboardData.setData("text",value);
		}
	}
};

function get_browser(){

//Browser Name

//Contents | JavaScript FAQ | Client & Browser Configuration FAQ     
//Question: How do I detect the browser name (vendor)?

//Answer: To establish the actual name of the user's Web browser, you can use the navigator.appName and navigator.userAgent properties. The userAgent property is more reliable than appName because, for example, Firefox (and some other browsers) may return the string "Netscape" as the value of navigator.appName for compatibility with Netscape Navigator. Note, however, that navigator.userAgent may be spoofed, too – that is, clients may substitute virtually any string for their userAgent. Therefore, whatever we deduce from either appName or userAgent should be taken with a grain of salt.

//The code example below uses navigator.userAgent to implement browser detection. It also uses navigator.appName and navigator.appVersion as a last resort only, if the userAgent string has an "unexpected" format. In your browser, this code produces the following output:

// Browser name = Safari
// Full version = 7.0.1
// Major version = 7
// navigator.appName = Netscape
// navigator.userAgent = Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_1) AppleWebKit/537.73.11 (KHTML, like Gecko) Version/7.0.1 Safari/537.73.11
// And here is the source code that performed the browser detection:

var nVer = navigator.appVersion;
var nAgt = navigator.userAgent;
var browserName  = navigator.appName;
var fullVersion  = ''+parseFloat(navigator.appVersion); 
var majorVersion = parseInt(navigator.appVersion,10);
var nameOffset,verOffset,ix;

// In Opera, the true version is after "Opera" or after "Version"
if ((verOffset=nAgt.indexOf("Opera"))!=-1) {
 browserName = "Opera";
 fullVersion = nAgt.substring(verOffset+6);
 if ((verOffset=nAgt.indexOf("Version"))!=-1) 
   fullVersion = nAgt.substring(verOffset+8);
}
// In MSIE, the true version is after "MSIE" in userAgent
else if ((verOffset=nAgt.indexOf("MSIE"))!=-1) {
 browserName = "Microsoft Internet Explorer";
 fullVersion = nAgt.substring(verOffset+5);
}
// In Chrome, the true version is after "Chrome" 
else if ((verOffset=nAgt.indexOf("Chrome"))!=-1) {
 browserName = "Chrome";
 fullVersion = nAgt.substring(verOffset+7);
}
// In Safari, the true version is after "Safari" or after "Version" 
else if ((verOffset=nAgt.indexOf("Safari"))!=-1) {
 browserName = "Safari";
 fullVersion = nAgt.substring(verOffset+7);
 if ((verOffset=nAgt.indexOf("Version"))!=-1) 
   fullVersion = nAgt.substring(verOffset+8);
}
// In Firefox, the true version is after "Firefox" 
else if ((verOffset=nAgt.indexOf("Firefox"))!=-1) {
 browserName = "Firefox";
 fullVersion = nAgt.substring(verOffset+8);
}
// In most other browsers, "name/version" is at the end of userAgent 
else if ( (nameOffset=nAgt.lastIndexOf(' ')+1) < 
          (verOffset=nAgt.lastIndexOf('/')) ) 
{
 browserName = nAgt.substring(nameOffset,verOffset);
 fullVersion = nAgt.substring(verOffset+1);
 if (browserName.toLowerCase()==browserName.toUpperCase()) {
  browserName = navigator.appName;
 }
}
// trim the fullVersion string at semicolon/space if present
if ((ix=fullVersion.indexOf(";"))!=-1)
   fullVersion=fullVersion.substring(0,ix);
if ((ix=fullVersion.indexOf(" "))!=-1)
   fullVersion=fullVersion.substring(0,ix);

majorVersion = parseInt(''+fullVersion,10);
if (isNaN(majorVersion)) {
 fullVersion  = ''+parseFloat(navigator.appVersion); 
 majorVersion = parseInt(navigator.appVersion,10);
}

return browserName;
}

(function (window) {
    {
        var unknown = '-';

        // screen
        var screenSize = '';
        if (screen.width) {
            width = (screen.width) ? screen.width : '';
            height = (screen.height) ? screen.height : '';
            screenSize += '' + width + " x " + height;
        }

        //browser
        var nVer = navigator.appVersion;
        var nAgt = navigator.userAgent;
        var browser = navigator.appName;
        var version = '' + parseFloat(navigator.appVersion);
        var majorVersion = parseInt(navigator.appVersion, 10);
        var nameOffset, verOffset, ix;

        // Opera
        if ((verOffset = nAgt.indexOf('Opera')) != -1) {
            browser = 'Opera';
            version = nAgt.substring(verOffset + 6);
            if ((verOffset = nAgt.indexOf('Version')) != -1) {
                version = nAgt.substring(verOffset + 8);
            }
        }
        // MSIE
        else if ((verOffset = nAgt.indexOf('MSIE')) != -1) {
            browser = 'Microsoft Internet Explorer';
            version = nAgt.substring(verOffset + 5);
        }
        // Chrome
        else if ((verOffset = nAgt.indexOf('Chrome')) != -1) {
            browser = 'Chrome';
            version = nAgt.substring(verOffset + 7);
        }
        // Safari
        else if ((verOffset = nAgt.indexOf('Safari')) != -1) {
            browser = 'Safari';
            version = nAgt.substring(verOffset + 7);
            if ((verOffset = nAgt.indexOf('Version')) != -1) {
                version = nAgt.substring(verOffset + 8);
            }
        }
        // Firefox
        else if ((verOffset = nAgt.indexOf('Firefox')) != -1) {
            browser = 'Firefox';
            version = nAgt.substring(verOffset + 8);
        }
        // MSIE 11+
        else if (nAgt.indexOf('Trident/') != -1) {
            browser = 'Microsoft Internet Explorer';
            version = nAgt.substring(nAgt.indexOf('rv:') + 3);
        }
        // Other browsers
        else if ((nameOffset = nAgt.lastIndexOf(' ') + 1) < (verOffset = nAgt.lastIndexOf('/'))) {
            browser = nAgt.substring(nameOffset, verOffset);
            version = nAgt.substring(verOffset + 1);
            if (browser.toLowerCase() == browser.toUpperCase()) {
                browser = navigator.appName;
            }
        }
        // trim the version string
        if ((ix = version.indexOf(';')) != -1) version = version.substring(0, ix);
        if ((ix = version.indexOf(' ')) != -1) version = version.substring(0, ix);
        if ((ix = version.indexOf(')')) != -1) version = version.substring(0, ix);

        majorVersion = parseInt('' + version, 10);
        if (isNaN(majorVersion)) {
            version = '' + parseFloat(navigator.appVersion);
            majorVersion = parseInt(navigator.appVersion, 10);
        }

        // mobile version
        var mobile = /Mobile|mini|Fennec|Android|iP(ad|od|hone)/.test(nVer);

        // cookie
        var cookieEnabled = (navigator.cookieEnabled) ? true : false;

        if (typeof navigator.cookieEnabled == 'undefined' && !cookieEnabled) {
            document.cookie = 'testcookie';
            cookieEnabled = (document.cookie.indexOf('testcookie') != -1) ? true : false;
        }

        // system
        var os = unknown;
        var clientStrings = [
            {s:'Windows 3.11', r:/Win16/},
            {s:'Windows 95', r:/(Windows 95|Win95|Windows_95)/},
            {s:'Windows ME', r:/(Win 9x 4.90|Windows ME)/},
            {s:'Windows 98', r:/(Windows 98|Win98)/},
            {s:'Windows CE', r:/Windows CE/},
            {s:'Windows 2000', r:/(Windows NT 5.0|Windows 2000)/},
            {s:'Windows XP', r:/(Windows NT 5.1|Windows XP)/},
            {s:'Windows Server 2003', r:/Windows NT 5.2/},
            {s:'Windows Vista', r:/Windows NT 6.0/},
            {s:'Windows 7', r:/(Windows 7|Windows NT 6.1)/},
            {s:'Windows 8.1', r:/(Windows 8.1|Windows NT 6.3)/},
            {s:'Windows 8', r:/(Windows 8|Windows NT 6.2)/},
            {s:'Windows NT 4.0', r:/(Windows NT 4.0|WinNT4.0|WinNT|Windows NT)/},
            {s:'Windows ME', r:/Windows ME/},
            {s:'Android', r:/Android/},
            {s:'Open BSD', r:/OpenBSD/},
            {s:'Sun OS', r:/SunOS/},
            {s:'Linux', r:/(Linux|X11)/},
            {s:'iOS', r:/(iPhone|iPad|iPod)/},
            {s:'Mac OS X', r:/Mac OS X/},
            {s:'Mac OS', r:/(MacPPC|MacIntel|Mac_PowerPC|Macintosh)/},
            {s:'QNX', r:/QNX/},
            {s:'UNIX', r:/UNIX/},
            {s:'BeOS', r:/BeOS/},
            {s:'OS/2', r:/OS\/2/},
            {s:'Search Bot', r:/(nuhk|Googlebot|Yammybot|Openbot|Slurp|MSNBot|Ask Jeeves\/Teoma|ia_archiver)/}
        ];
        for (var id in clientStrings) {
            var cs = clientStrings[id];
            if (cs.r.test(nAgt)) {
                os = cs.s;
                break;
            }
        }

        var osVersion = unknown;

        if (/Windows/.test(os)) {
            osVersion = /Windows (.*)/.exec(os)[1];
            os = 'Windows';
        }

        switch (os) {
            case 'Mac OS X':
                osVersion = /Mac OS X (10[\.\_\d]+)/.exec(nAgt)[1];
                break;

            case 'Android':
                osVersion = /Android ([\.\_\d]+)/.exec(nAgt)[1];
                break;

            case 'iOS':
                osVersion = /OS (\d+)_(\d+)_?(\d+)?/.exec(nVer);
                osVersion = osVersion[1] + '.' + osVersion[2] + '.' + (osVersion[3] | 0);
                break;
        }
        
        // flash (you'll need to include swfobject)
        /* script src="//ajax.googleapis.com/ajax/libs/swfobject/2.2/swfobject.js" */
        var flashVersion = 'no check';
        if (typeof swfobject != 'undefined') {
            var fv = swfobject.getFlashPlayerVersion();
            if (fv.major > 0) {
                flashVersion = fv.major + '.' + fv.minor + ' r' + fv.release;
            }
            else  {
                flashVersion = unknown;
            }
        }
    }

    window._ENV = {
        screen: screenSize,
        browser: browser,
        browserVersion: version,
        mobile: mobile,
        os: os,
        osVersion: osVersion,
        cookies: cookieEnabled,
        flashVersion: flashVersion,
        device: os+" "+osVersion+" "+browser
    };
}(this));

//本地数据管理
var LocalManager = function(){
    this.enabled = (typeof window.localStorage !== undefined);
    this.new_key = "__tab_new";
    this.modified_key = "__tab_modified";
    this.last_update = Date.now();

    this.init();
};

//初始化本地数据结构
LocalManager.prototype.init = function(){
    if(!this.enabled) return false;

    var nodes = {
        note: {},
        tag: {}
    };

    if(localStorage[this.new_key] === undefined) localStorage.setItem(this.new_key,JSON.stringify(nodes));
    if(localStorage[this.modified_key] === undefined) localStorage.setItem(this.modified_key,JSON.stringify(nodes));
};

LocalManager.prototype.addTag = function(tag){
    if(!this.enabled) return false;
    
    //强制加上时间戳
    tag.timestamp = Date.now();

    var new_node = $.parseJSON(localStorage[this.new_key]);

    //直接替换掉之前添加的
    new_node.tag = tag;
    localStorage[this.new_key] = JSON.stringify(new_node);
};

LocalManager.prototype.addNote = function(note){
    if(!this.enabled) return false;

    //强制加上时间戳
    note.timestamp = Date.now();

    var new_node = $.parseJSON(localStorage[this.new_key]);

    //直接替换掉之前添加的
    new_node.note = note;
    localStorage[this.new_key] = JSON.stringify(new_node);
};

LocalManager.prototype.updateTag = function(info){
    if(!this.enabled) return false;

    //强制加上时间戳
    info.timestamp = Date.now();
    var modified_node = $.parseJSON(localStorage[this.modified_key]);

    //直接替换掉之前修改的
    modified_node.tag = info;
    localStorage[this.modified_key] = JSON.stringify(modified_node);
};

LocalManager.prototype.updateNote = function(info){
    if(!this.enabled) return false;

    //强制加上时间戳
    info.timestamp = Date.now();

    var modified_node = $.parseJSON(localStorage[this.modified_key]);

    //直接替换掉之前修改的
    modified_node.note = info;
    localStorage[this.modified_key] = JSON.stringify(modified_node);
};

LocalManager.prototype.onStorageUpdate = function(event){

    if(!this.enabled) return false;

    var last_update = this.last_update;

    event = event || window.event;

    switch(event.key){
        case '__okmemo_ext_installed':
            if(event.newValue == '1' ){
                $('body').addClass('extension');
            }else if(event.newValue == '0'){
                $('body').removeClass('extension');
            }
            
            break;
        case '__logged_in':
            if(event.oldValue == null) return false;
            if(localStorage.__logged_in == '1'){
                $("body").removeClass("visitor");
            }else if(localStorage.__logged_in == '0'){
                $("body").addClass("visitor");
            }
            break;
        case '_theme':
            //重新设置主题
            //通知插件
            if(window.top == self){
                if(window.postMessage) window.postMessage({command:"set_theme",theme:event.newValue},"*");
            }else{
                if(window.postMessage) window.parent.postMessage({command:"set_theme",theme:event.newValue},"*");
            }
            break;
        //某一标签页下添加了
        case this.new_key:
            //如果是正在查看的tab则不用再次更新
            if($("body").hasClass("doc_visible")) break;
            try{
                var new_node = $.parseJSON(localStorage[this.new_key]);

                //新创建的节点，先看页面中是否已经存在此节点
                if(new_node.note && new_node.note.timestamp > last_update){
                    //new_note包含的信息包括
                    /**
                     1.创建时间
                     2.内容
                     3.id
                     4.tag_id
                     5.is_task
                     */

                     var note = new Note(new_node.note);
                         note.construct_item();

                     if(new_node.note.tag_id == 0) var $tag_con = $(".tag-result.tag-0");
                     else var $tag_con = $(".tag-result.tag-"+new_node.note.tag_id+",.tag-result.tag-0");

                     if($tag_con.length > 0 && $tag_con.find(".note-con[data-id=\""+new_node.note.id+"\"]").length == 0){
                        $tag_con.prepend(note.html);

                        $tag_con.find(".note-con[data-id=\""+new_node.note.id+"\"] .note.editable").each(function(){
                            $(this).data("value",note.content).html(decode_content(note.content));
                            load_image_entity(this);
                            configure_height(this);
                        });

                        //正在展示的标签面板更新数目
                        if($tag_con.hasClass("show")){
                            recount_in_tag("addnew");
                        }
                     }
                }

                if(new_node.tag && new_node.tag.timestamp > last_update){
                    /**
                     1.创建时间
                     2.name
                     3.id
                     4.position
                     */

                     //在搜索区域添加
                     $("#search_area .tags-con .tag-con").last().after("<div data-position=\""+new_node.tag.position+"\" class=\"tag-con\">"+
                                                            "<a draggable=\"false\" href=\"#\" class=\"tag finished\" data-id=\""+new_node.tag.id+"\">"+
                                                                "<span class=\"tag-name\">"+new_node.tag.name+"</span><span class=\"del-tag\"><span class=\"ok-icon-closeSmall\"></span></span>"+
                                                            "</a>"+
                                                        "</div>");

                     //在底部菜单中添加
                     $("#note_ops a.tag").last().after("<a href=\"#\" class=\"tag\" data-id=\""+new_node.tag.id+"\"><span class=\"tag-name\">"+new_node.tag.name+"</span></a>");
                }
            }catch(e){
                console.warn("json parse error");
                console.warn(e);
            }
            //更新更新时间
            this.last_update = Date.now();
            break;
        //某一浏览器标签下修改过了的一些笔记，数组
        case this.modified_key:
            if($("body").hasClass("doc_visible")) break;
            try{
                var modified = $.parseJSON(localStorage[this.modified_key]);

                if(modified.note && modified.note.timestamp > last_update){
                    var modified_note = modified.note;

                    //modified_note包含的信息包括
                    /**
                     1.修改类型(内容相关/任务相关/标签相关/删除)
                     2.修改的值
                     3.ID

                     例如:
                     {
                        type: content/task/tag/delete
                        value: ''/(finished/recovered/2014-12-12 00:00:00)/
                        id: 1234
                     }
                     */
                    if(modified_note.id){
                        switch(modified_note.type){
                            case "content":
                                //更新所有id为给定id的笔记
                                $(".note-con[data-id=\""+modified_note.id+"\"]").each(function(){
                                    if($(".note.editable",this).data("value") != modified_note.value){
                                        $(".note.editable",this).data("value",modified_note.value);
                                        var contentdiv = $(".note.editable",this).html(encode_content(modified_note.value)).get(0);
                                        load_image_entity(contentdiv);
                                        configure_height(contentdiv);
                                    }
                                });
                                break;
                            case "task":
                                var $task_panel = $(".tag-result.tag-"+$("#tag_tasks").data("id"));
                                //任务可修改的属性有:完成属性，设置任务期限
                                if(modified_note.value == "finish"){
                                    //如果任务面板中存在此条任务，且当前不再已经完成区域内，则将其放入已经完成区域
                                    $(".note-con[data-id=\""+modified_note.id+"\"]").each(function(){
                                        $(this).attr({"data-position":modified_note.position,"data-deadline":null})
                                        .data({"position":modified_note.position,"deadline":null}).find("form.note").addClass("finished");
                                    });

                                    //任务面板中对应的任务，
                                    var $task = $task_panel.find(".note-con#note-"+modified_note.id);

                                    //如果存在则将其放到任务列表已完成任务的前面
                                    if($task.length > 0){
                                        if($task_panel.find(".note-con.hidden").length > 0){
                                            $task_panel.find(".note-con.hidden").first().before($task);
                                        }else{
                                            $task.remove();
                                        }
                                    }
                                    recount_today_tasks("finished");
                                }else if(modified_note.value == "recover"){
                                    //如果任务面板中存在此条任务，且当前在已经完成的区域，则将其放入到以后区域放到最上面
                                    $(".note-con[data-id=\""+modified_note.id+"\"]").each(function(){
                                        $(this).removeClass("hidden").attr({"data-position":modified_note.position,"data-deadline":null})
                                        .data({"position":modified_note.position,"deadline":null}).find("form.note").removeClass("finished")
                                        .find(".checked.checkbox").removeClass("checked");
                                    });
                                    //任务面板中对应的任务，
                                    var $task = $task_panel.find(".note-con#note-"+modified_note.id);

                                    if($task.length > 0){
                                        //如果存在，则将其放入到以后区域的第一条
                                        $("#later_tasks h1.later-area").after($task);
                                    }
                                }else if(/\d{4}\-\d\d\-\d\d\s\d\d\:\d\d\:\d\d/.test(modified_note.value)){
                                    //设定截止期限,得到调整之后任务的position属性，然后放入相应的位置
                                    $(".note-con[data-id=\""+modified_note.id+"\"]").each(function(){
                                        $(this).addClass("task").attr({"data-task-id":modified_note.task_id,"data-position":modified_note.position,"data-deadline":modified_note.value})
                                        .data({"position":modified_note.position,"deadline":modified_note.value});
                                        var deadlineSet = '<div class="deadline"><span>'+modified_note.value+'</span></div>';
                                        if($(this).find('.note').find('.deadline').length==0){
                                            $(this).find('form.note').append(deadlineSet);
                                        }else if($(this).find('.note').find('.deadline').length>0){
                                            $(this).find('.deadline').html("<span>"+$(this).data("deadline")+"</span>");
                                        }
                                    });

                                    var $task = $task_panel.find(".note-con#note-"+modified_note.id);
                                    if($task.length > 0){

                                        if( $task.data("deadline") == get_formated_time(Date.now(),false) ){
                                            $task_today = $task_panel.find("#today_tasks");
                                            $task.addClass('today');
                                            if($task_today.find(".note-con").length>0){
                                                $task_today.find(".note-con").each(function(){
                                                    if($(this).data("position") < modified_note.position){
                                                        $(this).before($task);
                                                        return false;
                                                    }
                                                });
                                            }else{
                                                $task_today.append($task);
                                            }
                                            recount_today_tasks("change_today");
                                        }else{// 将以后的放下去
                                            $task.removeClass('today');
                                            $task_later = $task_panel.find("#later_tasks");
                                            if($task_later.find(".note-con").length>0){
                                                $task_later.find(".note-con").each(function(){
                                                    if($(this).data("position") < modified_note.position){
                                                        $(this).before($task);
                                                        return false;
                                                    }
                                                });
                                            }else{
                                                $task_later.append($task);
                                            }
                                            recount_today_tasks("change_date");
                                        }

                                    }
                                }else if(modified_note.value == "delete"){
                                    //删除任务则将任务从任务面板中删除
                                    $(".note-con[data-id=\""+modified_note.id+"\"]").each(function(){
                                        $(this).removeClass("task sortable").removeAttr("data-task-id").removeAttr("data-position");
                                    });

                                    //从任务面板中移除
                                    $task_panel.find(".note-con#note-"+modified_note.id).remove();
                                    recount_today_tasks("delete");
                                }else if(modified_note.value == "create"){
                                    //如果是新建任务，则将笔记移到任务面板
                                    //首先是其他面板中的所有同id的笔记需要添加任务属性
                                    $(".note-con[data-id=\""+modified_note.id+"\"]").each(function(){
                                        $(this).addClass("task").attr({"data-task-id":modified_note.task_id,"data-position":modified_note.position,"data-deadline":modified_note.deadline})
                                        .data({"task-id":modified_note.task_id,"position":modified_note.position,"deadline":modified_note.deadline});
                                    
                                        var deadlineSet = '<div class="deadline"><span>'+$(this).data("deadline")+'</span></div>';
                                        if($(this).find('.note').find('.deadline').length ==0){
                                            $(this).find('form.note').prepend(deadlineSet);
                                        }

                                    });

                                    //如果是在任务面板，则让判断在任务面板中是否存在，如果不存在则创建一条笔记(克隆现有的dom)
                                    if($task_panel.find(".note-con#note-"+modified_note.id).length == 0){
                                        var $task = $(".note-con#note-"+modified_note.id).clone(true,true);
                                        $task_panel.find(".note-con").each(function(){
                                            if($(this).data("position") < modified_note.position){
                                                $(this).before($task);
                                                return false;
                                            }
                                        });
                                    }
                                }else if(modified_note.value == null){//hugo added
                                    $(".note-con[data-id=\""+modified_note.id+"\"]").each(function(){
                                        $(this).attr({"data-task-id":modified_note.task_id,"data-position":modified_note.position,"data-deadline":null})
                                        .data({"task-id":modified_note.task_id,"position":modified_note.position,"deadline":null})
                                        .find('.deadline').remove();
                                        
                                    });
                                    var $task = $task_panel.find(".note-con#note-"+modified_note.id);
                                    console.log($task.data("deadline"));
                                    if($task.length > 0){
                                        // 将以后的任务提到今天
                                        if( $task.data("deadline") == get_formated_time(Date.now(),false) ){
                                            $task_today = $task_panel.find("#today_tasks");
                                            console.log('hugo:change today');
                                            $task.addClass('today');
                                            if($task_today.find(".note-con").length>0){
                                                $task_today.find(".note-con").each(function(){
                                                    if($(this).data("position") < modified_note.position){
                                                        $(this).before($task);
                                                        return false;
                                                    }
                                                });
                                            }else{
                                                $task_today.append($task);
                                            }
                                            recount_today_tasks("change_today");
                                        }else{// 将以后的放下去
                                            $task.removeClass('today');
                                            var $task_later = $task_panel.find("#later_tasks");
                                            if($task_later.find(".note-con").length>0){
                                                $task_later.find(".note-con").each(function(){
                                                    if($(this).data("position") < modified_note.position){
                                                        $(this).before($task);
                                                        return false;
                                                    }
                                                });
                                            }else{
                                                $task_later.append($task);
                                            }
                                            recount_today_tasks("change_date");
                                        }

                                    }
                                }else if(modified_note.value == "sort"){
                                    var $task = $task_panel.find(".note-con#note-"+modified_note.id);
                                    // 判定是否改变类型
                                    if(modified_note.dateType){


                                            $(".note-con[data-id=\""+modified_note.id+"\"]").each(function(){
                                                $(this).attr({"data-task-id":modified_note.task_id,"data-position":modified_note.position,"data-deadline":modified_note.deadline})
                                                .data({"task-id":modified_note.task_id,"position":modified_note.position,"deadline":modified_note.deadline});
                                            });
                                        // 以后改为今天
                                        if(modified_note.dateType == "today"){
                                                $task_today = $task_panel.find("#today_tasks");
                                                $task.addClass('today');
                                                var $taskDL = $task.find('.deadline');
                                                if($taskDL.length>0){
                                                    $taskDL.html("<span>" + modified_note.deadline + "</span>");
                                                }else{
                                                    var deadlineCon = "<div class=\"deadline\"><span>" + modified_note.deadline + "</span></div>"
                                                    $task.find("form.note").prepend(deadlineCon);
                                                }
                                                if($task_today.find(".note-con").length>0){
                                                    $task_today.find(".note-con").each(function(){
                                                        if($(this).data("position") < modified_note.position){
                                                            $(this).before($task);
                                                            return false;
                                                        }
                                                    });
                                                }else{
                                                    $task_today.append($task);
                                                }
                                                recount_today_tasks("change_today");

                                        }else if(modified_note.dateType == "later"){
                                            $task.removeClass('today').find('.deadline').remove();
                                            var $task_later = $task_panel.find("#later_tasks");
                                            if($task_later.length>0){
                                                $task_later.find(".note-con").each(function(){
                                                    console.log('change from today to later run');
                                                    if($(this).data("position") < modified_note.position){
                                                        $(this).before($task);
                                                        return false;
                                                    }
                                                });
                                            }else{
                                                $task_later.append($task);
                                            }
                                            recount_today_tasks("change_date");
                                        }
                                    }else{
                                        if($task.hasClass("today")){
                                            $task_today = $task_panel.find("#today_tasks");
                                            if($task_today.find(".note-con").length>0){
                                                $task_today.find(".note-con").each(function(){
                                                    if($(this).data("position") < modified_note.position){
                                                        $(this).before($task);
                                                        return false;
                                                    }
                                                });
                                            }else{
                                                $task_today.append($task);
                                            }
                                        }else{
                                            var $task_later = $task_panel.find("#later_tasks");
                                            $(".note-con[data-id=\""+modified_note.id+"\"]").attr({"data-task-id":modified_note.task_id,"data-position":modified_note.position,"data-deadline":modified_note.deadline})
                                            .data({"task-id":modified_note.task_id,"position":modified_note.position,"deadline":modified_note.deadline});
                                            if($task_later.find(".note-con").length>0){
                                                $task_later.find(".note-con").each(function(){
                                                    if($(this).data("position") < modified_note.position){
                                                        $(this).before($task);
                                                        return false;
                                                    }
                                                });
                                            }else{
                                                $task_later.append($task);
                                            }
                                        }
                                    }
                                    
                                }
                                break;
                            case "tag":
                                //如果添加了tag则需要在tag下的笔记列表中添加笔记，如果是删除了则需要相应地在相应标签下删除笔记
                                //value为+id 代表添加标签，-id代表去除某标签

                                if(/\+[\d]+/.test(modified_note.value)){
                                    var tid = modified_note.value.substr(1);
                                    var $tag_con = $(".tag-result.tag-"+tid);
                                    //先在该标签下找这条笔记，如果找到了则不用继续添加
                                    //if($tag_con.find(".note-con[data-id=\""+modified_note.id+"\"]").length > 0) break;

                                    var $note_con = $(".note-con[data-id=\""+modified_note.id+"\"]");
                                    if($note_con.length == 0) break;
                                        
                                        var linkid = $("#tag_links").data("id"),
                                            conid = $("#tag_contacts").data("id");
                                        // 判断有没有颜色块
                                        if(tid == conid || tid == linkid){
                                            var default_tags_contacts = "<div class=\"default_tag contacts\" data-id=\""+conid+"\" style=\"background:"+ $("#tag_contacts").data("color") + "\"></div>";
                                            var default_tags_links = "<div class=\"default_tag links\" data-id=\""+linkid+"\" style=\"background:"+ $("#tag_links").data("color") + "\"></div>";

                                            if( $note_con.find('.strips') ){
                                                if( tid == conid && $note_con.find('.strips').find('.default_tag[data-id="'+tid+'"]').length == 0 ){
                                                    if( tid == conid && $note_con.find('.strips').find('.default_tag[data-id="'+linkid+'"]').length > 0 ){
                                                        $note_con.find('.strips').find('.default_tag[data-id="'+linkid+'"]').after(default_tags_contacts);
                                                    }else{
                                                        $note_con.find('.strips').prepend(default_tags_contacts);
                                                    }
                                                }
                                                if( tid == linkid && $note_con.find('.strips').find('.default_tag[data-id="'+tid+'"]').length == 0 )
                                                    if( tid == linkid && $note_con.find('.strips').find('.default_tag[data-id="'+conid+'"]').length > 0 ){
                                                        $note_con.find('.strips').find('.default_tag[data-id="'+conid+'"]').before(default_tags_links);
                                                    }else{
                                                        $note_con.find('.strips').append(default_tags_links);
                                                    }
                                            }else{
                                                var strips = "<div class=\"strips\"></div>";
                                                if(tid == conid){
                                                    $note_con.append(strips);
                                                    $note_con.find('.strips').prepend(default_tags_contacts);
                                                }
                                                if(tid == linkid){
                                                    console.log('no strips');
                                                    $note_con.append(strips);
                                                    $note_con.find('.strips').append(default_tags_links);
                                                }
                                            }
                                        }
                                    
                                    if($tag_con.length > 0){
                                        $tag_con.find(".note-con").each(function(){
                                            if($(this).data("id") < modified_note.id){
                                                $(this).before($note_con.get(0));
                                            }
                                        });
                                        
                                    }
                                }else if(/\-[\d]+/.test(modified_note.value)){
                                    var tid = modified_note.value.substr(1);
                                    var $tag_con = $(".tag-result.tag-"+tid);
                                    // 判断有没有颜色块
                                    // 要删掉所有目录下的颜色块而不只是当前的tag的
                                    var $note_con = $(".tag-result").find(".note-con[data-id=\""+modified_note.id+"\"]");
                                    var linkid = $("#tag_links").data("id"),
                                        conid = $("#tag_contacts").data("id");
                                        if( $note_con.find('.strips').length >0 ){
                                            if( tid == conid || tid == linkid ){
                                                $note_con.find('.strips').find('.default_tag[data-id="'+tid+'"]').remove();
                                            }
                                        }

                                    if($tag_con.length > 0){
                                        //找到对应的笔记，然后删除
                                        $tag_con.find(".note-con[data-id=\""+modified_note.id+"\"]").remove();
                                    }
                                    if($tag_con.hasClass("show")){
                                        recount_in_tag("delete");
                                    }

                                }
                                break;
                            case "delete":
                                if($(".note-con[data-id=\""+modified_note.id+"\"]").closest('.tag-result').hasClass('show')){
                                    recount_in_tag("delete");
                                }
                                $(".note-con[data-id=\""+modified_note.id+"\"]").remove();
                                break;
                            default: break;
                         }
                    }
                }

                if(modified.tag && modified.tag.timestamp >= last_update){
                    //标签的修改：1.标签名字，2.顺序，3.删除
                    var modified_tag = modified.tag;
                    console.log(modified_tag);
                    if(modified_tag.id){
                        switch(modified_tag.type){
                            case "name":
                                $("a.tag[data-id=\""+modified_tag.id+"\"] .tag-name").text(modified_tag.value);
                                break;
                            case "delete":
                                var $tag_con = $("#search_area a.tag[data-id=\""+modified_tag.id+"\"]").closest(".tag-con");

                                //如果是删除的固定区域的标签则还需要更新宽度
                                if($tag_con.length > 0){
                                    if($tag_con.hasClass("pined")){
                                        //如果删除的是当前的tag，则跳转到all
                                        if($tag_con.hasClass("active")){
                                            $("#tag_all").trigger("click");
                                        }
                                        $tag_con.remove();
                                        var $pined = $("#search_area .pined-tags .tag-con.pined")
                                        $pined.width( 100/$pined.length + "%" );
                                    }
                                }
                                $("#notes_con a.tag[data-id=\""+modified_tag.id+"\"]").remove();
                                $("#note_ops a.tag[data-id=\""+modified_tag.id+"\"]").remove();
                                break;

                            //下面是复杂操作，暂时不考虑
                            case "position":
                                var lmDirection = modified_tag.srcpos > modified_tag.dstpos ? "up" : "down";
                                // 改变position 不需要改变所有DOM，只有被操作的需要改变，似乎服务器上还有bug
                                var $tag_posCon = $("#search_area .tag-con a[data-id=\""+modified_tag.id+"\"]").closest(".tag-con"),
                                    $tag_dstposCon = $("#search_area .tag-con[data-position=\""+modified_tag.dstpos+"\"");                                
                                var isPin = false;
                                // 在这里处理是否上去pin，拖下来tag也是在这里处理，在 case "unpin"上处理挤下去的事件
                                if(modified_tag.pin){

                                    if(modified_tag.pin == 1){
                                        isPin = true;
                                        var $pintag_con = $("#search_area .tag-con a[data-id=\""+modified_tag.id+"\"]").closest(".tag-con");
                                        var $pintag_area = $("#search_area .by-tag .pined-tags");
                                        //判断是否存在pin标签
                                        var pinNum = $pintag_area.find(".pined").not(".all").not(".tmp-pined").length;
                                        if(pinNum == 0){
                                            $pintag_area.find(".all").after($pintag_con);
                                        }else{
                                            // 判断目标tag是否被挤下去，如果被挤下去了就直接放在pin的最后一个
                                            if(!$tag_dstposCon.hasClass('pined')){
                                                if($pintag_area.find(".tmp-pined")){
                                                    $pintag_area.find(".tmp-pined").before($pintag_con);
                                                }else{
                                                    $pintag_area.prepend($pintag_con);
                                                }
                                            }else $tag_dstposCon.before($pintag_con);
                                        }
                                        // 赋予样式属性
                                        $pintag_con.addClass('pined');
                                        var new_pined_num = $(".pined-tags .pined.tag-con").not(".clone").length;
                                        var new_pined_width = 100/new_pined_num + "%";
                                        // 重新设置一下所有pin的样式
                                        $("#search_area .tag-con.pined").width(new_pined_width);
                                    }else if(modified_tag.pin == "un"){
                                        var $unpintag_con = $("#search_area .tag-con a[data-id=\""+modified_tag.id+"\"]").closest(".tag-con");
                                        var $unpintag_area = $("#search_area .by-tag .custom-tags .tags-con");
                                        //$unpintag_area.prepend($unpintag_con);
                                        $tag_dstposCon.after($unpintag_con);
                                        $unpintag_con.width("");
                                        // 赋予样式属性
                                        $unpintag_con.removeClass('pined');
                                        var new_pined_num = $(".pined-tags .pined.tag-con").not(".clone").length;
                                        var new_pined_width = 100/new_pined_num + "%";
                                        $("#search_area .tag-con.pined").width(new_pined_width);
                                    }                                    
                                }else{
                                    // 不在pin上排序时
                                    if(lmDirection == "up"){
                                        $tag_dstposCon.before($tag_posCon);
                                    }
                                    else{
                                        $tag_dstposCon.after($tag_posCon);
                                    }
                                    
                                }
                                change_order(lmDirection, modified_tag.srcpos, modified_tag.dstpos);
                                break;
                            case "unpin":
                                var $unpintag_con = $("#search_area .tag-con a[data-id=\""+modified_tag.id+"\"]").closest(".tag-con");
                                var $unpintag_area = $("#search_area .by-tag .custom-tags .tags-con");
                                $unpintag_area.prepend($unpintag_con);
                                $unpintag_con.width("");
                                // 赋予样式属性
                                $unpintag_con.removeClass('pined');
                                break;
                            default: break;
                        }
                    }
                }

                //更新更新时间
                this.last_update = Date.now();
            }catch(e){
                console.warn("json parse error");
                console.warn(e);
            }
            break;
        default: break;
    };
};
idl.LM = idl.LM ? idl.LM : new LocalManager();

// 未登陆用户应用
var APP = {
    version: 1.0,
    audience: "guest",
    max_tags_num: 20,
    imgwallItemInitWidth: 204,
    _evgranted: 0,
    ext_installed: !!localStorage.__okmemo_ext_installed && localStorage.__okmemo_ext_installed == "1" || $("body").hasClass("extension"),
    
    get_last_opened_tag: function(){
        //从localStorage中获取所有tags
        // var tags = this.get_all_tags();
        
        // //如果存在tag,则找出最近打开的
        // if(tags){
        //     if(tags.length > 0){
        //         //对tag按最后打开时间进行逆序排序
        //         tags.sort(function(a,b){
        //             if(a.last_access > b.last_access) return -1;
        //             else return 1;
        //         });

        //         var last_opened_tag = tags.shift();
        //         if(last_opened_tag.last_access == null) return this.get_all_notes();
        //         return new Tag(last_opened_tag);
        //     }else{
        //         //默认取出记事tag下的便签
        //         return this.get_all_notes();
        //     }
        // }
        if(localStorage.last_opened_tid == "0" || localStorage.last_opened_tid === undefined){
            //返回所有标签
            return new Tag({id:0,name:"all",default:1});
        }else{
            var last_opened_tag = this.get_tag(localStorage.last_opened_tid);
            return new Tag(last_opened_tag);
        }
    },

    list_tags: function(){
        var tags = this.get_all_tags(),tag=null;
        var last_opened_tag = this.get_last_opened_tag();

        //添加到搜索栏
        var pined_first = true;
        var pined_html = "";
        var first_class = "";
        
        if(tags && tags.length > 0){
            //固定区域标签
            var pined_tags = tags.filter(function(tag,index,arr){
                return !!tag.pined;
            });

            //给固定标签排序
            pined_tags = pined_tags.sort(function(a,b){
                return (a.position > b.position) ? 1 : -1;
            });

            var pined_html = "";
            
            //非固定区域标签
            var unpined_tags = tags.filter(function(tag,index,arr){
                return !!!tag.pined;
            });

            //给非固定标签排序
            unpined_tags = unpined_tags.sort(function(a,b){
                return (a.position > b.position) ? 1 : -1;
            });
            
            var unpined_html = "";

            var first_class = last_class = false;
            var pined_tag_width = 100/(pined_tags.length+1) + "%";

            //如果有临时固定标签则
            if(localStorage.last_tmppined_tid && localStorage.last_tmppined_tid > 0){
                pined_tag_width = 100/(pined_tags.length+2) + "%";
            }

            pined_html = "<div class=\"tag-con pined all default"+((0 == last_opened_tag.id)?" active":"")+"\" style=\"width:"+pined_tag_width+"\">"+
                        "<a draggable=\"false\" href=\"#\" class=\"all default-tag tag"+((0 == last_opened_tag.id)?" active":"")+"\" id=\"tag_all\" data-id=\"0\">"+
                        "<span class=\"tag-name\">"+((this.lang.TAG_ALL) ? this.lang.TAG_ALL : "all")+"</span>"+
                        "</a></div>";

            for(var i=0,len=pined_tags.length; i<len; i++){
                tag = pined_tags[i];
                if(i == 0) first_class = " first";
                else first_class = "";

                if(i == len-1) last_class = " last";
                else last_class = "";

                if(i == 0){
                    pined_html = "<div class=\"tag-con pined all default"+((0 == last_opened_tag.id)?" active":"")+"\" style=\"width:"+pined_tag_width+"\">"+
                                "<a draggable=\"false\" href=\"#\" class=\"all default-tag tag"+((0 == last_opened_tag.id)?" active":"")+"\" id=\"tag_all\" data-id=\"0\">"+
                                "<span class=\"tag-name\">"+((this.lang.TAG_ALL) ? this.lang.TAG_ALL : "all")+"</span>"+
                                "</a></div>";
                }

                if(!!tag.default){
                    var lang_token = ("tag_"+tag.name).toUpperCase();
                    var tag_name = (this.lang[lang_token]) ? this.lang[lang_token] : tag.name;
                    pined_html += "<div data-position=\""+tag.position+"\" class=\"tag-con pined"+first_class+last_class+" default"+((tag.id == last_opened_tag.id)?" active":"")+"\" style=\"width:"+pined_tag_width+"\">"+
                            "<a draggable=\"false\" href=\"#\" class=\""+tag.name+" default-tag tag"+((tag.id == last_opened_tag.id)?" active":"")+"\" id=\"tag_"+tag.name+"\""+(tag.color?" data-color=\""+tag.color+"\" style=\"color:"+tag.color+"\"":"")+" data-id=\""+tag.id+"\"><span class=\"tag-name\">"+tag_name+"</span><span class=\"del-tag\"><span class=\"ok-icon-closeSmall\"></span></span></a>"+
                            "</div>";
                }else{
                    pined_html += "<div data-position=\""+tag.position+"\" class=\"tag-con pined"+first_class+last_class+""+((tag.id == last_opened_tag.id)?" active":"")+"\" style=\"width:"+pined_tag_width+"\">"+
                            "<a draggable=\"false\" href=\"#\" class=\"tag"+((tag.id == last_opened_tag.id)?" active":"")+"\" "+(tag.color?" data-color=\""+tag.color+"\" style=\"color:"+tag.color+"\"":"")+" data-id=\""+tag.id+"\"><span class=\"tag-name\">"+tag.name+"</span><span class=\"del-tag\"><span class=\"ok-icon-closeSmall\"></span></span></a>"+
                            "</div>";
                }
            }

            //将临时固定标签附到固定标签后面
            if(localStorage.last_tmppined_tid && localStorage.last_tmppined_tid > 0){
                var tmp_pined_tag = this.get_tag(localStorage.last_tmppined_tid);
                var tmp_pined_html = "";
                if(tmp_pined_tag){
                    if(!!tmp_pined_tag.default){
                        var lang_token = ("tag_"+tmp_pined_tag.name).toUpperCase();
                        var tag_name = (this.lang[lang_token]) ? this.lang[lang_token] : tmp_pined_tag.name;
                        tmp_pined_html += "<div data-position=\""+tmp_pined_tag.position+"\" class=\"tag-con pined tmp-pined default"+((tmp_pined_tag.id == last_opened_tag.id)?" active":"")+"\" style=\"width:"+pined_tag_width+"\">"+
                                "<a draggable=\"false\" href=\"#\" class=\""+tmp_pined_tag.name+" default-tag tag"+((tmp_pined_tag.id == last_opened_tag.id)?" active":"")+"\" id=\"tag_"+tmp_pined_tag.name+"\""+(tmp_pined_tag.color?" data-color=\""+tmp_pined_tag.color+"\" style=\"color:"+tmp_pined_tag.color+"\"":"")+" data-id=\""+tmp_pined_tag.id+"\"><span class=\"tag-name\">"+tag_name+"</span><span class=\"del-tag\"><span class=\"ok-icon-closeSmall\"></span></span></a>"+
                                "</div>";
                    }else{
                        tmp_pined_html += "<div data-position=\""+tmp_pined_tag.position+"\" class=\"tag-con pined tmp-pined default"+((tmp_pined_tag.id == last_opened_tag.id)?" active":"")+"\" style=\"width:"+pined_tag_width+"\">"+
                                "<a draggable=\"false\" href=\"#\" class=\"tag"+((tmp_pined_tag.id == last_opened_tag.id)?" active":"")+"\" id=\"tag_"+tmp_pined_tag.name+"\""+(tmp_pined_tag.color?" data-color=\""+tmp_pined_tag.color+"\" style=\"color:"+tmp_pined_tag.color+"\"":"")+" data-id=\""+tmp_pined_tag.id+"\"><span class=\"tag-name\">"+tmp_pined_tag.name+"</span><span class=\"del-tag\"><span class=\"ok-icon-closeSmall\"></span></span></a>"+
                                "</div>";
                    }

                    if(tmp_pined_html != ""){
                        pined_html += tmp_pined_html;
                    }
                }
            }

            //固定标签区域放入固定标签
            $("#search_area .by-tag .pined-tags").html(pined_html);

            for(var i=0,len=unpined_tags.length; i<len; i++){
                tag = unpined_tags[i];
                var tmp_class = (tag.id == localStorage.last_tmppined_tid) ? " tmp-hidden" : "" ;
                if(!!tag.default){
                    var lang_token = ("tag_"+tag.name).toUpperCase();
                    var tag_name = (this.lang[lang_token]) ? this.lang[lang_token] : tag.name;
                    unpined_html += "<div data-position=\""+tag.position+"\" class=\"tag-con default"+((tag.id == last_opened_tag.id)?" active":"")+tmp_class+"\">"+
                                "<a href=\"#\" id=\"tag_"+tag.name+"\" draggable=\"false\""+
                                " class=\"tag default-tag "+tag.name+" "+((tag.id == last_opened_tag.id)? " active" : "")+"\""+
                                " data-num=\"\" data-id=\""+tag.id+"\" "+((tag.color) ? "data-color=\""+tag.color+"\"" : "")+" "+((tag.color) ? "style=\"color:"+tag.color+"\"" : "")+">"+
                                "<span class=\"tag-name\">"+tag_name+"</span><span class=\"del-tag\"><span class=\"ok-icon-closeSmall\"></span></span>";
                }else{
                    unpined_html += "<div data-position=\""+tag.position+"\" class=\"tag-con"+((tag.id == last_opened_tag.id)?" active":"")+tmp_class+"\">"+
                                "<a href=\"#\" draggable=\"false\""+
                                " class=\"tag "+((tag.id == last_opened_tag.id)? " active" : "")+"\""+
                                " data-num=\"\" data-id=\""+tag.id+"\" "+((tag.color) ? "data-color=\""+tag.color+"\"" : "")+" "+((tag.color) ? "style=\"color:"+tag.color+"\"" : "")+">"+
                                "<span class=\"tag-name\">"+tag.name+"</span><span class=\"del-tag\"><span class=\"ok-icon-closeSmall\"></span></span>";
                }

                if(tag.name == "tasks"){
                    unpined_html += "<span class=\"today-num\"></span>";
                }

                unpined_html += "</a>"+
                            "</div>";
            }

            //非固定标签区域放入非固定标签
            $("#search_area .by-tag .custom-tags .tags-con").prepend(unpined_html);
        }

        return tags;
    },

    get_all_notes: function(){
        //得到所有未被删除的笔记
        if(APP.notes){
            saved_notes = APP.notes.filter(function(tmp_note){
                if(!!!tmp_note.deleted) return true;
            });
            return saved_notes;
        }
    },

    get_all_tags: function(){
        var tags = $.parseJSON(localStorage.tags);
        if(tags && tags.length > 0){
            var tag_objs = new Array();

            for(var i=0,len=tags.length; i<len; i++){
                tag_objs.push(new Tag(tags[i]));
            }
        }

        return tag_objs;
    },

    init_dataset: function(){
        //先检查是否在之前已经初始化过本地数据结构
        if(!this.is_localdb_set()){
            this.set_localdb();
        }

        this.notes = JSON.parse(localStorage.notes);
        this.tags = JSON.parse(localStorage.tags);
        this.images = JSON.parse(localStorage.images);
        this.links = JSON.parse(localStorage.links);
        this.tasks = JSON.parse(localStorage.tasks);
        if(localStorage.lang) this.lang = JSON.parse(localStorage.lang);
        localStorage.data_changed = 0;

        //进入此页面即代表未登录
        localStorage.__logged_in = 0;

        if(!!localStorage.__okmemo_ext_installed && localStorage.__okmemo_ext_installed == "1"){
            //$("body").addClass("extension");
        }
    },

    //当数据更新的时候,
    onStorageUpdate: function(event){
        event = event || window.event;

        switch(event.key){
            case '__okmemo_ext_installed':
                if(event.newValue == '1' ){
                    $('body').addClass('extension');
                }else if(event.newValue == '0'){
                    $('body').removeClass('extension');
                }
                
                break;
            case '__logged_in':
                console.log(event.newValue);
                if(event.oldValue == null) return false;
                if(localStorage.__logged_in == '1'){
                    //location.reload();
                }else if(localStorage.__logged_in == '0'){
                    //location.reload();
                }
                break;
            default: return false;
        };
    },

    //刷新数据，从新从本地存储中取出数据，另外，新添加的数据也展示出来
    refresh: function(){
        if(localStorage.data_changed == "1")
            APP.initialize();
        else
            console.log("no data changed");
    },

    initialize: function(){
        //初始化本地数据结构
        this.init_dataset();

        //检查浏览器扩展是否安装
        this.check_ext_installed();

        //列出所有tag
        var tags = this.list_tags();

        //给出便签底部tag选项
        if(tags && tags.length > 0){
            var bottom_tag,bottom_tags_html = "";
            for(var i=0,len=tags.length; i<len; i++){
                bottom_tag = tags[i];
                if(!!bottom_tag.default){
                    var lang_token = ("tag_"+bottom_tag.name).toUpperCase();
                    var tag_name = (this.lang[lang_token]) ? this.lang[lang_token] : bottom_tag.name;
                }else{
                    var tag_name = bottom_tag.name;
                }
                bottom_tags_html += "<a href=\"#\" class=\"tag"+
                                    ((!!bottom_tag.color)?" colored-tag":"")+"\""+
                                    ((!!bottom_tag.default)?" id=\"tag_"+bottom_tag.name+"\"":"")+""+
                                    ((!!bottom_tag.color)?" data-color=\""+bottom_tag.color+"\" style=\"color: "+bottom_tag.color+"\" ":"")+
                                    "data-id=\""+bottom_tag.id+"\""+
                                    ">"+tag_name+"</a>";
            }

            //如果已经有tag在其中，则去掉以免重复添加
            $("#note_ops .tags.section div.custom a.tag").remove();
            $("#note_ops .tags.section div.custom").prepend(bottom_tags_html);
        }

        //得到最后一次打开的tag
        var tag = this.get_last_opened_tag();

         //
        if(!!tag.default){
            $("#search_results").addClass("results-of-"+tag.name);
            var lang_token = ("tag_"+tag.name).toUpperCase();
            var tag_name = (this.lang[lang_token]) ? this.lang[lang_token] : tag.name;
        }else{
            $("#search_results").addClass("custom-tag-results");
            var tag_name = tag.name;
        }

        //更新标题
        $("#title_sec span.title").text(APP.lang.TITLE_TEMP_MEMOS);

        //列出最后一次打开tag的便签
        if(tag) tag.list_notes();
    },

    install_ext: function(success,error){
        if(typeof chrome != "undefined" && chrome.webstore){
            $("#install_area").addClass("installing");
            chrome.webstore.install("https://chrome.google.com/webstore/detail/nejabgnmljggkeofllackkopgjgdcamp",success,error);
        }else if(typeof InstallTrigger != "undefined"){
            var params = {
                    "ext name": { URL: location.origin+"/download/extension/firefox",
                             IconURL: location.origin+"/extension/images/icon-32.png",
                             Hash: "",
                             toString: function () { return this.URL; }
                    }
                };
              InstallTrigger.install(params);
        }else if(typeof safari != "undefined"){
            
        }
    },

    //检测插件是否安装
    check_ext_installed: function(){
        if(window._ENV) $("#install_area .browser-name").html(_ENV.browser);

        return !!localStorage.__okmemo_ext_installed && localStorage.__okmemo_ext_installed == "1" && $("body").hasClass("extension");
    },

    //弹出安装插件按钮
    show_install_btn: function(){
        if(this.check_ext_installed()) return false;
        //$("#install_area").addClass("active");
        $("#install_area").fadeIn();
    },

    hide_install_btn: function(){
        // $("#install_area").removeClass("active");
        $("#install_area").fadeOut();
    },

    //弹出登录窗口
    toggle_authwin: function(register){
        //如果在框架页面
        if(window != window.top){
            var login_win = null;
            var third_party = "";
            var newwin_height = 400,
                newwin_width = 280,
                newwin_top = (window.screen.height - newwin_height) / 2,
                newwin_left = (window.screen.width - newwin_width) / 2;
                if(register){
                    var url = location.origin+"/user/login#register";
                }else{
                    var url = location.origin+"/user/login";
                }
                login_win = window.open(url,'授权登录','height='+newwin_height+',width='+newwin_width+',top='+newwin_top+',left='+newwin_left+',toolbar=no,menubar=no,scrollbars=yes,resizable=no,location=no,status=no');
        }else{
            $("body").toggleClass("login-popup");
        }
    },

    get_device: function(){
        if(window._ENV) return _ENV.os+" "+_ENV.browser;
    },

    get_note: function(id){
        var saved_note = APP.notes.filter(function(tmp_note){
                return tmp_note.id == id;
            });

        if(saved_note && saved_note.length > 0) return saved_note[0];
        return false;
    },

    get_tag: function(id){
        var saved_tag = APP.tags.filter(function(tmp_tag){
                return tmp_tag.id == id;
            });
        if(saved_tag && saved_tag.length > 0) return saved_tag[0];
        return false;
    },

    get_task: function(id){
        var saved_task = APP.tasks.filter(function(tmp_task){
                return tmp_task.id == id;
            });
        if(saved_task && saved_task.length > 0) return saved_task[0];
        return false;
    },

    check_integrity: function(resources){
        if(resources){
            if(APP[resources] && localStorage[resources]){

                //目前只检测所存储的资源长度
                if(APP[resources].length != JSON.parse(localStorage[resources]).length ){
                    APP[resources] = JSON.parse(localStorage[resources]);
                }
            }
        }
    },

    save_tags: function(pageload){
        if(this.tags) localStorage.tags = JSON.stringify(this.tags);
        if(!pageload) localStorage.data_changed = 1;
    },

    save_notes: function(){
        if(this.notes) localStorage.notes = JSON.stringify(this.notes);
        localStorage.data_changed = 1;
    },

    save_images: function(){
        if(this.images) localStorage.images = JSON.stringify(this.images);;
        localStorage.data_changed = 1;
    },

    save_links: function(){
        if(this.links) localStorage.links = JSON.stringify(this.links);
        localStorage.data_changed = 1;
    },

    save_tasks: function(){
        if(this.tasks) localStorage.tasks = JSON.stringify(this.tasks);
        localStorage.data_changed = 1;
    },

    is_localdb_set: function(){
        return  localStorage.localdb_set && !!parseInt(localStorage.localdb_set);
    },

    is_yxgranted: function(){
        return localStorage._yxgranted && !!parseInt(localStorage._yxgranted);
    },

    is_gtgranted: function(){
        return localStorage._gtgranted && !!parseInt(localStorage._gtgranted);
    },

    is_evgranted: function(){
        return localStorage._evgranted && !!parseInt(localStorage._evgranted);
    },

    //初始化本地数据结构
    set_localdb: function(){
        var app = this;
        var links_con = new Array();
        var images_con = new Array();
        var tasks_con = new Array();
        var notes_con = new Array();
        var tags_con = new Array();

        var created_stamp = Date.now();

        var locale = "en";

        //通过浏览器设置得到语言
        var langs = navigator.language.split(",");
        if(langs.length > 0){
            for(var i=0,len=langs.length; i<len; i++){
                var lang = langs[i].toLowerCase();
                if(lang == "zh-cn" || lang == "zh-tw" || lang == "zh-hk" || lang == "sg"){
                    locale = "zh";
                }
            }
        }

        var tutors_text = [
            {
                "zh":"<b>教程 1</b><br>OK记是目前最高效的网页摘录工具，你可以试着从右边的网页中拖拽一段文字、图片、或者链接到这里，即可形成一个摘录，我们称之为“一条贴纸”。",
                "en":""
            },
            {
                "zh":"<b>教程 2</b><br>您也可以在最上方的输入框里随时记下笔记、灵感、电话号码——任何事情。",
                "en":""
            },
            {
                "zh":"<b>教程 3</b><br>点击左边的勾框以完成这个任务型贴纸吧！您随时可以把一条记事贴纸转换成任务贴纸。只要您为贴纸设定了日期即可。点击这个小日历试试 ↓ ",
                "en":""
            },
            {
                "zh":"<b>教程 4</b><br>您知道吗，点击箭头所指处，图片可以一键下载，试试吧？<a href=\""+location.origin+"/layout/images/tutors/tutor_dl_image.jpg"+"\" rel=\"image\" contenteditable=\"false\">"+location.origin+"/layout/images/tutors/tutor_dl_image.jpg"+"</a>",
                "en":""
            },
            {
                "zh":"<b>教程 5</b><br>收藏的图片太多了？试试这个按纽，（贴纸列表最上方）您会惊喜的。<a href=\""+location.origin+"/layout/images/tutors/tutor_open_wall.jpg"+"\" rel=\"image\" contenteditable=\"false\">"+location.origin+"/layout/images/tutors/tutor_open_wall.jpg"+"</a>",
                "en":""
            },
            {
                "zh":"<b>教程 6</b><br>OK记还支持Android和IOS等移动设备，点击上方的图片即可获得下载二维码，当然，您也可以点击这里进行下载。<a href=\""+location.origin+"/layout/images/tutors/tutor_dl_app.jpg"+"\" rel=\"image\" contenteditable=\"false\">"+location.origin+"/layout/images/tutors/tutor_dl_app.jpg"+"</a>",
                "en":""
            },
        ];

        var tasks_text = [
            {
                "zh":"当您为贴纸添加“任务”tag时，或者设定了“执行日期”时，此贴纸就转换为“任务”，您今天的任务就是阅读理解这条贴纸。阅读完成了？非常好，请点击本任务左边的勾框来完成吧！对了，需要注意的是，每个贴纸都可以有多个Tag，您可以点击贴纸下方的标签小图标为它增加或者减少Tag属性。当您去除本贴纸的“任务”Tag后，它将在此类中消失，但在其它tag类中依然存在，如果您删除了此贴纸，它将在所有的Tag类中都被删除。",
                "en":""
            },
            {   
                "zh":"点击最上方的人像或者“登陆”按钮，进入“用户设置”，为自己起个昵称吧，当您分享贴纸时，将会显示您的昵称。",
                "en":""
            }
        ];

        var readslater_text = [
            {
                "zh":"当您浏览网页时，在您感兴趣的新闻，影像，网页链接 上点击右键，选择“加入稍后阅读”，即可收藏入本类。空瑕时再进行阅读。比如<a href=\"http://www.goodreads.com/author/quotes/875661.Rumi\" rel=\"link\">这首短诗</a>就值得一读。",
                "en":""
            }
        ];

        var info_text = [
            {
                "zh":"本标签是系统智能生成，您记录的贴纸中如果包含有电子邮件，地址，电话，身份证号码，社会保险号…之类的信息，OK记会智能分析并加上“信息”的tag，所以您在此类下就能看到所有的“信息”贴纸啦。如有疑问，可以邮件我们support@okay.do  需要注意的是，每个贴纸都可以有多个Tag，您可以点击贴纸下方的标签小图标，为它增加或者减少Tag属性。",
                "en":""
            }
        ];

        var image_text = [
            {
                "zh":"本标签是系统自动生成，会将您摘录含有有图片的贴纸自动加上“图片”Tag，并编入此类。所以您在本标签下就能看到所有的“图片”贴纸啦。需要注意的是，每个贴纸都可以有多个Tag，您可以点击贴纸下方的标签小图标为它增加或者减少Tag属性。<a href=\""+location.origin+"/layout/images/tutors/image_example2.jpg"+"\" rel=\"image\" contenteditable=\"false\">"+location.origin+"/layout/images/tutors/image_example2.jpg"+"</a>",
                "en":""
            }
        ];

        //添加默认笔记(几个教程)
        var tutor6 = {
            id: 6,
            title: "",
            // content: "<b>教程 6</b><br>OK记还支持Android和IOS等移动设备，点击上方的图片即可获得下载二维码，当然，您也可以点击这里进行下载。<a href=\""+location.origin+"/layout/images/tutors/tutor_dl_app.jpg"+"\" rel=\"image\" contenteditable=\"false\">"+location.origin+"/layout/images/tutors/tutor_dl_app.jpg"+"</a>",
            content: tutors_text[5][locale],
            task_id: 0,
            device: (window._ENV && _ENV.device) ? _ENV.device : "",
            source: "https://m.okay.do",
            tags: [6,4],
            location: "",
            created: get_formated_time(created_stamp - 1000 * 6,true),
            created_stamp: created_stamp - 1000 * 6,
            modified: get_formated_time(created_stamp - 1000 * 6,true),
            deleted: null
        };

        var tutor5 = {
            id: 5,
            title: "",
            // content: "<b>教程 5</b><br>收藏的图片太多了？试试这个按纽，（贴纸列表最上方）您会惊喜的。<a href=\""+location.origin+"/layout/images/tutors/tutor_open_wall.jpg"+"\" rel=\"image\" contenteditable=\"false\">"+location.origin+"/layout/images/tutors/tutor_open_wall.jpg"+"</a>",
            content: tutors_text[4][locale],
            task_id: 0,
            device: (window._ENV && _ENV.device) ? _ENV.device : "",
            source: "https://m.okay.do",
            tags : [6,4],
            location: "",
            created: get_formated_time(created_stamp - 1000 * 5,true),
            created_stamp: created_stamp - 1000 * 5,
            modified: get_formated_time(created_stamp - 1000 * 5,true),
            deleted: null
        };

        var tutor4 = {
            id: 4,
            title: "",
            // content: "<b>教程 4</b><br>您知道吗，点击箭头所指处，图片可以一键下载，试试吧？<a href=\""+location.origin+"/layout/images/tutors/tutor_dl_image.jpg"+"\" rel=\"image\" contenteditable=\"false\">"+location.origin+"/layout/images/tutors/tutor_dl_image.jpg"+"</a>",
            content: tutors_text[3][locale],
            task_id: 0,
            device: (window._ENV && _ENV.device) ? _ENV.device : "",
            source: "https://m.okay.do",
            tags : [6,4],
            location: "",
            created: get_formated_time(created_stamp - 1000 * 4,true),
            created_stamp: created_stamp - 1000 * 4,
            modified: get_formated_time(created_stamp - 1000 * 4,true),
            deleted: null
        };

        var tutor3 = {
            id: 3,
            title: "",
            // content: "<b>教程 3</b><br>点击左边的勾框以完成这个任务型贴纸吧！您随时可以把一条记事贴纸转换成任务贴纸。只要您为贴纸设定了日期即可。点击这个小日历试试 ↓ ",
            content: tutors_text[2][locale],
            task_id: 1,
            device: (window._ENV && _ENV.device) ? _ENV.device : "",
            source: "https://m.okay.do",
            tags : [6,2],
            location: "",
            created: get_formated_time(created_stamp - 1000 * 3,true),
            created_stamp: created_stamp - 1000 * 3,
            modified: get_formated_time(created_stamp - 1000 * 3,true),
            deleted: null
        };

        var tutor2 = {
            id: 2,
            title: "",
            // content: "<b>教程 2</b><br>您也可以在最上方的输入框里随时记下笔记、灵感、电话号码——任何事情。",
            content: tutors_text[1][locale],
            task_id: 0,
            device: (window._ENV && _ENV.device) ? _ENV.device : "",
            source: "https://m.okay.do",
            tags : [6],
            location: "",
            created: get_formated_time(created_stamp - 1000 * 2,true),
            created_stamp: created_stamp - 1000 * 2,
            modified: get_formated_time(created_stamp - 1000 * 2,true),
            deleted: null
        };

        var tutor1 = {
            id: 1,
            title: "",
            // content: "<b>教程 1</b><br>OK记是目前最高效的网页摘录工具，你可以试着从右边的网页中拖拽一段文字、图片、或者链接到这里，即可形成一个摘录，我们称之为“一条贴纸”。",
            content: tutors_text[0][locale],
            task_id: 0,
            device: (window._ENV && _ENV.device) ? _ENV.device : "",
            source: "https://m.okay.do",
            tags : [6],
            location: "",
            created: get_formated_time(created_stamp - 1000 * 1,true),
            created_stamp: created_stamp - 1000 * 1,
            modified: get_formated_time(created_stamp - 1000 * 1,true),
            deleted: null
        };

        notes_con = [tutor6,tutor5,tutor4,tutor3,tutor2,tutor1];

        //"#009FE8","#A6DB00","#FFCE00","#DD0000","#CA44F5"
        //加入一些默认数据，如系统提供的5个tag
        var notes_tag = {
            id: 1,
            name: "readslater",
            pined: 1,
            default: 1,
            color: null,
            position: 1,
            last_access: null,
            created: get_current_time(),
            created_stamp: Date.now()
        };

        var tasks_tag = {
            id: 2,
            name: "tasks",
            pined: 0,
            default: 1,
            color: null,
            position: 2,
            last_access: null,
            created: get_current_time(),
            created_stamp: Date.now()
        };

        //添加默认标签
        var inspirations_tag = {
            id: 2,
            name: "inspirations",
            pined: 0,
            default: 1,
            color: null,
            position: 3,
            last_access: null,
            created: get_current_time(),
            created_stamp: Date.now()
        };

        var links_tag = {
            id: 3,
            name: "links",
            pined: 0,
            default: 1,
            color: "#009FE8",
            position: 4,
            last_access: null,
            created: get_current_time(),
            created_stamp: Date.now()
        };

        var images_tag = {
            id: 4,
            name: "images",
            pined: 0,
            default: 1,
            color: null,
            position: 5,
            last_access: null,
            created: get_current_time(),
            created_stamp: Date.now()
        };

        var contacts_tag = {
            id: 5,
            name: "contacts",
            pined: 0,
            default: 1,
            color: "#F29600",
            position: 6,
            last_access: null,
            created: get_current_time(),
            created_stamp: Date.now()
        };

        var tutors_tag = {
            id: 6,
            name: "tutorials",
            pined: 0,
            default: 1,
            color: null,
            position: 7,
            last_access: null,
            created: get_current_time(),
            created_stamp: Date.now()
        };
        tags_con = [notes_tag,tasks_tag,inspirations_tag,links_tag,images_tag,contacts_tag,tutors_tag];

        //添加默认的任务
        var task_example = {
            created: get_current_time(),
            created_stamp: created_stamp,
            deadline: null,
            deleted: null,
            finished: null,
            id: 1,
            modified: null,
            position: 3
        };
        tasks_con = [task_example];

        //各种结构体的容器
        localStorage.notes = JSON.stringify(notes_con);
        localStorage.tags = JSON.stringify(tags_con);
        localStorage.links = JSON.stringify(links_con);
        localStorage.images = JSON.stringify(images_con);
        localStorage.tasks = JSON.stringify(tasks_con);

        //标识用户是否登录
        localStorage.__logged_in = 0;


        //将本地是否存在本地数据结构设为1
        localStorage.localdb_set = 1;

        //页面完全加载完之后再加载其他标签需要的笔记
        $(window).on("load",function(){
            var created_stamp = Date.now() - 1000 * 60 * 60;
            var created = get_formated_time(created_stamp,true);
            var curnum = app.notes.length;
            var info_example_note = {
                id: curnum,
                title: "",
                // content: "本标签是系统智能生成，您记录的贴纸中如果包含有电子邮件，地址，电话，身份证号码，社会保险号…之类的信息，OK记会智能分析并加上“信息”的tag，所以您在此类下就能看到所有的“信息”贴纸啦。如有疑问，可以邮件我们support@okay.do  需要注意的是，每个贴纸都可以有多个Tag，您可以点击贴纸下方的标签小图标，为它增加或者减少Tag属性。",
                content: info_text[0][locale],
                task_id: 0,
                device: (window._ENV && _ENV.device) ? _ENV.device : "",
                source: "https://m.okay.do",
                tags : [6,5],
                location: "",
                created: created,
                created_stamp: created_stamp,
                modified: created,
                deleted: null
            };

            var image_example_note = {
                id: curnum + 1,
                title: "",
                // content: "本标签是系统自动生成，会将您摘录含有有图片的贴纸自动加上“图片”Tag，并编入此类。所以您在本标签下就能看到所有的“图片”贴纸啦。需要注意的是，每个贴纸都可以有多个Tag，您可以点击贴纸下方的标签小图标为它增加或者减少Tag属性。<a href=\""+location.origin+"/layout/images/tutors/image_example2.jpg"+"\" rel=\"image\" contenteditable=\"false\">"+location.origin+"/layout/images/tutors/image_example2.jpg"+"</a>",
                content: image_text[0][locale],
                task_id: 0,
                device: (window._ENV && _ENV.device) ? _ENV.device : "",
                source: "https://m.okay.do",
                tags : [6,4],
                location: "",
                created: created,
                created_stamp: created_stamp,
                modified: created,
                deleted: null
            };

            var task_example_1 = {
                created: created,
                created_stamp: created_stamp,
                deadline: get_formated_time(Date.now(),false),
                deleted: null,
                finished: null,
                id: 2,
                modified: null,
                position: 1
            };

            var task_example_2 = {
                created: created,
                created_stamp: created_stamp,
                deadline: null,
                deleted: null,
                finished: null,
                id: 3,
                modified: null,
                position: 2
            };

            var task_example_note_1 = {
                id: curnum + 2,
                title: "",
                // content: "当您为贴纸添加“任务”tag时，或者设定了“执行日期”时，此贴纸就转换为“任务”，您今天的任务就是阅读理解这条贴纸。阅读完成了？非常好，请点击本任务左边的勾框来完成吧！对了，需要注意的是，每个贴纸都可以有多个Tag，您可以点击贴纸下方的标签小图标为它增加或者减少Tag属性。当您去除本贴纸的“任务”Tag后，它将在此类中消失，但在其它tag类中依然存在，如果您删除了此贴纸，它将在所有的Tag类中都被删除。",
                content: tasks_text[0][locale],
                task_id: 2,
                device: (window._ENV && _ENV.device) ? _ENV.device : "",
                source: "https://m.okay.do",
                tags : [6,2],
                location: "",
                created: created,
                created_stamp: created_stamp,
                modified: created,
                deleted: null
            };

            var task_example_note_2 = {
                id: curnum + 3,
                title: "",
                // content: "点击最上方的人像或者“登陆”按钮，进入“用户设置”，为自己起个昵称吧，当您分享贴纸时，将会显示您的昵称。",
                content: tasks_text[1][locale],
                task_id: 3,
                device: (window._ENV && _ENV.device) ? _ENV.device : "",
                source: "https://m.okay.do",
                tags : [6,2],
                location: "",
                created: created,
                created_stamp: created_stamp,
                modified: created,
                deleted: null
            };

            var readslater_exmaple_1 = {
                id: curnum + 4,
                title: "",
                // content: "当您浏览网页时，在您感兴趣的新闻，影像，网页链接 上点击右键，选择“加入稍后阅读”，即可收藏入本类。空瑕时再进行阅读。比如<a href=\"http://www.goodreads.com/author/quotes/875661.Rumi\" rel=\"link\">这首短诗</a>就值得一读。",
                content: tasks_text[0][locale],
                task_id: 2,
                device: (window._ENV && _ENV.device) ? _ENV.device : "",
                source: "https://m.okay.do",
                tags : [6,1],
                location: "",
                created: created,
                created_stamp: created_stamp,
                modified: created,
                deleted: null
            };

            app.tasks = app.tasks || [];
            app.tasks.push(task_example_1,task_example_2);
            localStorage.tasks = JSON.stringify(app.tasks);
            app.notes.push(task_example_note_1,task_example_note_2,info_example_note,image_example_note,readslater_exmaple_1);
            localStorage.notes = JSON.stringify(app.notes);
        });
    },

    load_language: function(callback){
        $.get("/guest/get_lang",function(data){
            localStorage.lang = data;
            console.log(data);
            APP.lang = JSON.parse(data);
        });
    },

    //oauth认证成功
    oauth_success: function(app){
        //刷新页面并传递给首页相应地参数
        window.location.reload();
        if(window.localStorage){
            localStorage.__logged_in = 1;
        }
    },

    //oauth认证失败
    oauth_failure: function(app){
        //
        showMessage({type:"error",msg:app+"认证授权失败",autoclose:true});
    },

    //框架中展示便签
    display_note: function(note){
        //保存成功，如果用户装了插件，每创建5条便签弹出一次登录框，如果没装插件则提示装插件
        if(this.notes.length % 5 == 0){
            if(this.ext_installed){
                this.toggle_authwin();
            }else{
                this.show_install_btn();
            }
        }

        $("#title_sec").removeClass("alert").offset();
        $("#title_sec").addClass("alert");

        var extension = this;
        var new_class = "newly_added"+Date.now();
        note.construct_item(new_class);

        //添加地理位置
        if(jQuery("body").hasClass("geo_on")){
            get_position(function(lnglat){
                if(lnglat){
                    var coords = lnglat.lat + "|" + lnglat.lng;
                    note.add_coords(coords,function(data){
                        if(console) console.log(data);
                    });
                }
            });
        }

        //分类
        var default_type = "all";
        var $active_tag = $("#search_area .by-tag .tag.active");

        //按照面板分类，
        if(/\bresults\-of\-(tasks|contacts|readslater|links|images)\b/.test($("#search_results").attr("class"))){
            //得到系统默认分类
            default_type = jQuery("#search_results").attr("class").match(/\bresults\-of\-(tasks|contacts|links|images|readslater)\b/)[1];
            $active_tag = $("#tag_"+default_type);
        }

        //默认放入当前面板
        var $panel = jQuery("#search_results .by-tag.result .tag-result.show");

        //如果是稍后阅读，则不放入当前面板，而是放入稍后阅读和所有中，如果稍后阅读和所有面板都不存在的话，直接返回
        if(note.readslater){
            var tag_id = $("#tag_readslater").data("id");
            if($(".tag-result.tag-"+tag_id).length > 0){
                $panel = $(".tag-result.tag-"+tag_id);
            }else if($(".tag-result.tag-0").length > 0){
                $panel = $(".tag-result.tag-0");
            }else{
                $panel = null;
            }
        }

        //如果将便签添加到图片或者链接，则必须包含链接，如果不包含链接，则切换到笔记面板
        // if(default_type == "images" || default_type == "links"){
        //     if(!link_regexp.test(note.content) && !ip_link_regexp.test(note.content)){
        //         //切换到笔记面板
        //         $("#search_area .by-tag .tag#tag_notes").trigger("click");
        //         //如果不存在乘装结果的容器，则创建一个
        //         if($("#search_results .by-tag .tag-result.tag-"+$("#tag_notes").data("id")).length == 0){
        //             $("#search_results .by-tag").append("<div class=\"tag-result tag-"+$("#tag_notes").data("id")+"\"></div>");
        //         }

        //         $("#search_results .by-tag .tag-result.tag-"+$("#tag_notes").data("id")).addClass("show").prepend(note.html);
        //     }else{
        //         //放入当前打开的面板中
        //         if($panel) $panel.prepend(note.html);
        //     }
        // }else{
            
        // }

        //放入当前打开的面板中
        if($panel) $panel.prepend(note.html);
        if($panel && $panel.hasClass("show")) recount_in_tag("addnew");

        var note_node = jQuery("#search_results .by-tag.result .note-con."+new_class+" "+content_area).data("value",note.content).attr("contenteditable",true).get(0);
        var that = note_node;
        var note_con = jQuery("#search_results .note-con."+new_class).get(0);
        if(note_node){
            var form = jQuery(that).closest("form");
            var note_con = jQuery(that).closest(".note-con");

            //通知css已经放入笔记面板
            jQuery(note_con).addClass("ready").attr("data-created",Date.now());

            read_mode(note_node);
            jQuery("#search_results .by-tag.result .note-con."+new_class+" "+content_area).data("value",note.content);
            
            load_image_entity(note_node);

            //调整高度
            configure_height(note_node);

            //通知css笔记已经布好局
            jQuery(note_con).removeClass("ready").addClass("finish-layout");

            //在任务面板中添加便签
            if($("#search_results").hasClass("results-of-tasks") && !note.readslater) $(note_con).addClass("task");
            
            //如果不是"所有"标签下，则还要拷贝一份到"所有"标签下
            var $all_result_con = $(".tag-result.tag-0");

            if($all_result_con.length > 0 && (!$all_result_con.hasClass("show") || note.readslater) ){

                if($all_result_con.find(".note-con."+new_class).length == 0){
                    var $all_tag = $("#search_area .tag-con.all a.tag");

                    var current_all_num = $all_tag.data("num") ? $all_tag.data("num") : $all_result_con.find(".note-con").length;
                    
                    $all_tag.data({"last_refresh":get_current_time(),"num":current_all_num+1})
                            .attr({"data-num":current_all_num+1,"data-last_refresh":get_current_time()});


                    $all_result_con.prepend($(note_con).clone(true,true));
                }
            }

            //本地数据更新
            idl.LM.addNote({
                id: note.id,
                is_task: $(note_con).hasClass("task"),
                content: note.content,
                finished: 0,
                tag_id: $active_tag.data("id"),
                timestamp: Date.now()
            });
        }

        //去掉动画
        setTimeout(function(){
            jQuery(".finish-layout").each(function(){
                if(Date.now() - jQuery(this).data("created") > 1000){
                    jQuery(this).removeClass("finish-layout");
                }
            });
        },2000);

        if(jQuery("#search_results").hasClass("custom-tag-results")){
            //自定义标签面板中添加，非默认五大分类
            default_type = "custom";
            $active_tag = $("#search_area .by-tag .tag.active");

            //如果是稍后阅读则不加入当前标签
            if(!note.readslater){
                note.addTag($active_tag.data("id"),function(data){
                    var feedback = data;

                    if(feedback.status == "ok"){
                        
                    }else{

                    }
                });
            }
        }

        //自动分类
        note.classify(default_type,function(o){
            var stick_types = o.types ? o.types : new Array();
            
            var feedback = o.data;
            if(feedback.status && feedback.status == "ok"){
                //为便签添加上相应的颜色
                var default_tag = null,color="";
                if(!note_node) return ;

                for(var i=0,len=stick_types.length; i<len; i++){
                    default_tag = jQuery("#tag_"+stick_types[i]).get(0);
                    tag_id = jQuery(default_tag).data("id");

                    //更新本地数据
                    idl.LM.updateNote({
                        type: "tag",
                        value: "+"+tag_id,
                        id: note.id
                    });

                    if(default_tag){
                        //如果添加的当前的标签有色彩值，则需要为新建的便签加上色彩值
                        var color = jQuery(default_tag).data("color");

                        jQuery("#search_results .note-con."+new_class).each(function(){
                            
                            if(!!color && $(this).find(".default_tag[data-id=\""+tag_id+"\"]").length == 0){
                                if(stick_types[i] == 'links'){
                                    $('.strips',this).prepend("<div class=\"default_tag\" data-id=\""+tag_id+"\" style=\"background:"+color+"\"></div>");
                                }else if(stick_types[i] == 'contacts'){
                                    $('.strips',this).append("<div class=\"default_tag\" data-id=\""+tag_id+"\" style=\"background:"+color+"\"></div>");
                                }
                            }

                        });
                    }

                    if(stick_types[i] == "tasks"){
                        jQuery(that).addClass("task");
                    }

                    //添加上了对应的标签，如果标签处于在本地已经有缓存的状态，则将此条新便笺加入其缓存
                    var $tag_result_con = $(".tag-result.tag-"+tag_id);
                    if($tag_result_con.length > 0 && !$tag_result_con.hasClass("show")){
                        if($tag_result_con.find(".note-con."+new_class).length == 0){
                            var $tag = $("#search_area a.tag[data-id=\""+tag_id+"\"]");
                            var current_tag_num = $tag.data("num") ? $tag.data("num") : $tag_result_con.find(".note-con").length;
                            $tag.data({"last_refresh":get_current_time(),"num":current_tag_num+1}).attr("data-num",current_tag_num+1);
                            $tag_result_con.prepend($(note_con).clone(true,true));
                        }
                    }
                }
            }else{
                if(console) console.log(o);
            }
        });
    },

    lb_start: function(){
        var winScrollTop = Math.max($(window).scrollTop(),$("#wrapper").scrollTop());

        //让笔记变为侧栏
        $("body,html").addClass("ok-lightbox-on");

        //容器滚动到上次浏览到的位置
        $("#wrapper").scrollTop(winScrollTop);

        //更新搜索栏宽度
        stickyWidth = $('#notes_con .inner-wrapper').width();
        $("#search_area").width(stickyWidth);

        push_window("ok-lightbox-on");

        $("#lightbox .lb-image").removeClass("start");
    },

    lb_end: function(){
        if($("body").hasClass("ok-lightbox-on")){
            var wrapperScrollTop = $("#wrapper").scrollTop();

            if(window.postMessage){
                //发送给假插件
                try{
                    window.top.postMessage({command:"close_lb"},location.origin);
                }catch(e){
                    
                }
                

                //发送给真实地插件
                window.postMessage({command:"close_lb"},location.origin);
            }

            $("body,html").removeClass("ok-lightbox-on");

            pop_window("ok-lightbox-on");

            stickyWidth = $('#notes_con .inner-wrapper').width();
            $("#search_area").width(stickyWidth);

            //滚动到当前便签位置
            $(window).scrollTop(wrapperScrollTop);
        }
        
    }
};

var User = function(o){
    this.nickname = o.nickname || "";
    this.password = o.password || "";
    this.old_password = o.old_password || "";
};

User.prototype = {
    check_registered: function(email,callback){
        callback = $.isFunction(callback) ? callback : null;
        if(this.is_valid("email",email)){
            $.post("user/check_registered",{type:"ajax",from:"web",email:email},callback);
        }
    },

    load_lang: function(page,callback){
        callback = $.isFunction(callback) ? callback : null;

        $.get("/user/load_lang/"+page,{type:"ajax",from:"web"},callback);
    },

    is_valid: function(field,value){
        switch(field){
            case "nickname": return !(/[<>()*&^%$#@!~]/.test(value) || /^\s{0,}$/.test(value) || value.length > 20);break;
            case "password": return (/[0-9a-z.]{4,}/i.test(value));break;
            case "email": return email_field_regexp.test(value);break;
            default: return false;
        };
    }
};

var Tag = function(o){
	this.name = o.name || "";
	this.id = o.id || 0;
	this.isid = o.isid || 0;
    this.last_access = o.last_access || null;
    this.created = o.created || null;
    this.color = o.color || null;
    this.default = o.default || 0;
    this.pined = o.pined || 0;
    this.position = o.position || undefined;

    if(this.name == "tasks"){
        this.is_task = true;
        this.today_tasks_num = this.get_today_tasks_num();
    }
	return this;
};

Tag.prototype = {	
	save_url: "/tag/add",
    del_url: "/tag/del",
    alter_name_url: "/tag/alter_name",
    bulk_attach_url: "/tag/bulk_add_tag",
    set_color_url: "/tag/set_color",
    update_access_url: "/tag/update_last_access",
    pin_url: "/tag/pin",
    unpin_url: "/tag/unpin",
    properties: ["id","name"],
    save: function(callbefore,callback){
        if(arguments.length == 2){
            if(jQuery.isFunction(callbefore)){
                callbefore.call(this);
            }
        }else if(arguments.length == 1){
            callback = callbefore;
        }else{
            callback = function(){};
        }

        return (this.id && this.id>0) ? this.update(callback) : this.create(callback);
    },

    checkParam : function(){
        var valid = true,
            required_params = this.param.required,
            optional_params = this.param.optional;
        for(var i=0,len=required_params.length;i<len;i++){
            if(!this[required_params[i]]){
                valid = false;
            }else if(this[required_params[i]] && !this.is_valid(required_params[i],this[required_params[i]])){
                valid = false;
            }
        }

        return valid;
    },

    create: function(callback){
        var tag = this;
        var tag_exists = APP.tags.filter(function(tmp_tag){
            return tmp_tag.name == tag.name;
        });

        if(tag_exists.length == 0){
            var new_tag = {
                id: APP.tags.length + 1,
                name: tag.name,
                created: get_current_time(),
                created_stamp: Date.now(),
                default: 0,
                pined: 0,
                color: null,
                last_access: null
            };

            //保存之前先判断变量存储的标签跟localStorage中存储的是否相等，若不相等则先更新变量再保存
            APP.check_integrity('tags');

            APP.tags.push(new_tag);
            APP.save_tags();
            if(new_tag){
                $.isFunction(callback) ? callback({status:"ok",tagid:new_tag.id}) : nul;
            }
        }
    },

    //改变标签的展示顺序并且改变标签的固定属性
    rearrange: function(pinit,dir,oripos,dstpos,callback){
        callback = $.isFunction(callback) ? callback : null;

        if((dir == "up" || dir == "down") && !isNaN(oripos) && !isNaN(dstpos)){
            if(pinit == 1){
                //将当前标签加入固定区域
                this.pinIt();
            }else if(pinit == 0){
                //将当前标签解除固定
                this.unpinIt();
            }

            //改变标签顺序
            var position;

            if(dir == "down"){
                $(APP.tags).each(function(idx,tag){
                    position = tag.position;

                    if(position >= oripos && position <= dstpos){
                        if((position - 1) < oripos){
                            tag.position = dstpos;
                        }else{
                            tag.position = position - 1;
                        }
                    }
                });
            }else{
                $(APP.tags).each(function(idx,tag){
                    position = tag.position;

                    if(position <= oripos && position >= dstpos){
                        if((position + 1) > oripos){
                            tag.position = dstpos;
                        }else{
                            tag.position = position + 1;
                        }
                    }
                });
            }

            //保存标签
            APP.save_tags();
            if(callback && $.isFunction(callback)) callback({status:"ok"});
        }

        //参数错误
        if(callback && $.isFunction(callback)) callback({status:"error"});
    },

    update: function(callback){
        var properties = this.properties,updatems = new Array();
        for(var i=0,len = properties.length; i<len; i++){

            if(properties[i] == "pub"){
                if(this[properties[i]] != undefined){
                    updatems.push(properties[i]);
                }
            }else{
                if(this[properties[i]] && properties[i] != "id"){
                    updatems.push(properties[i]);
                }
            }
        }
        
        if(updatems.length == 1){
            var item = updatems[0];
            switch(item){
                case "name": return this.altername(callback);break;
                case "pub": return this.togglepublic(callback);break;
                default: return false;break;
            }
        }
        return false;
    },

    //得到今日任务数量
    get_today_tasks_num: function(){

    },

    //得到所有今日任务
    get_today_tasks: function(){
        var tasks_tag = this.get_tag_by_tagname("tasks");
        var notes = tasks_tag.get_notes();

        //从所有note中得出今日任务

    },

    get_unfinished_tasks: function(){
        
    },

    //展示此tag下的便签，如果是任务的话需要带上一些任务属性如：deadline,finished,position
    list_notes: function(){
        var notes = this.get_notes();

        var html = "";
        $("#title_sec span.num").text("("+notes.length+")");

        //判断当前tag容器是否存在，不存在则创建一个，存在则直接将html附进去
        var notes_con = this.get_notes_con();

        $("#search_results .tag-result.show").removeClass("show");
        $(notes_con).addClass("show");

        var saved_tag = APP.get_tag(this.id);

        if(notes && notes.length > 0){
            if(saved_tag.name == "tasks"){
                var task,today = get_formated_time(Date.now());

                //如果是取出所有任务，则需要先附上所有任务属性再排序
                for(var i=0,len=notes.length; i<len; i++){
                    task = APP.get_task(notes[i].task_id);

                    if(task){
                        notes[i].finished = task.finished;
                        notes[i].deadline = task.deadline;
                        notes[i].is_task = true;
                        notes[i].position = task.position;
                        notes[i].is_today = (task.deadline == today);
                    }
                }

                //若是任务面板，则需要将所有任务分为今日任务和以后任务区域和已完成区域
                //今日区域和以后区域的任务都按照position排序，已完成区域按照完成时间倒序排序
                var today_tasks = notes.filter(function(tmp_note){
                    return tmp_note.deadline <= today && !!!tmp_note.finished && !!!tmp_note.deleted;
                });
                $("#tag_tasks span.today-num").text(today_tasks.length);

                //position由大至小排序
                today_tasks.sort(function(a,b){
                    if(a.position > b.position) return -1;
                    else return 1;
                });

                //得到以后任务,无时间期限或者时间期限在今日之后未被删除未被完成的任务
                var later_tasks = notes.filter(function(tmp_note){
                    return (tmp_note.deadline > today || !!!tmp_note.deadline) && !!!tmp_note.finished && !!!tmp_note.deleted;
                });
                
                //position从大到小排序
                later_tasks.sort(function(a,b){
                    if(a.position > b.position) return -1;
                    else return 1;
                });

                //完成了但没有被删除的任务
                var finished_tasks = notes.filter(function(tmp_note){
                    return !!tmp_note.finished && !!!tmp_note.deleted;
                });
                
                //按完成时间从大到小排序
                finished_tasks.sort(function(a,b){
                    if(a.finished > b.finished) return -1;
                    return 1;
                });

                //分别将这些任务归位
                var note = null,html = "<div id=\"today_tasks\"><h1 class=\"today-area\">"+APP.lang["DATE_TD"]+"<hr></h1>";
                for(var i=0,len=today_tasks.length; i<len; i++){
                    note = new Note(today_tasks[i]);
                    note.get_colored_tags();
                    html += note.construct_item("newly_loaded").html;
                }
                html += "</div>";

                html += "<div id=\"later_tasks\"><h1 class=\"later-area\">"+APP.lang["DATE_LTR"]+"<hr></h1>";
                for(var i=0,len=later_tasks.length; i<len; i++){
                    note = new Note(later_tasks[i]);
                    note.get_colored_tags();
                    html += note.construct_item("newly_loaded").html;
                }

                for(var i=0,len=finished_tasks.length; i<len; i++){
                    note = new Note(finished_tasks[i]);
                    note.get_colored_tags();
                    html += note.construct_item("newly_loaded").html;
                }
                html += "</div>";
                $(notes_con).html(html);
            }else{
                notes.sort(function(a,b){
                    if(a.created > b.created) return -1;
                    else return 1;
                });
            
                var note = null,html="";
                
                for(var i=0,len=notes.length; i<len; i++){
                    note = new Note(notes[i]);
                    note.get_colored_tags();
                    note.is_task = note.is_atask();
                    html += note.construct_item("newly_loaded").html;
                }

                $(notes_con).html(html);
            }

            $(".note-con.newly_loaded",notes_con).each(function(){
                var $note = $(this).find(content_area);

                if($note.length > 0){
                    $note.data("value",$note.html());
                    var content = decode_content($note.html());
                    $note.html(content);
                    configure_height($note.get(0));
                }

                $(this).removeClass("newly_loaded");

                var that = $note.get(0);
                load_image_entity($note.get(0));
            });
            
            highlight_colored_tags();
        }

        //更新最后访问时间
        if(saved_tag){
            var saved_tag = APP.get_tag(this.id);
            
            saved_tag.last_access = Date.now();
            APP.save_tags(true);
        }

        return html;
    },



    //得到此tag的便签容器
    get_notes_con: function(){
        if(this.notes_con) return this.notes_con;

        if(!this.notes_con_exists()) return this.create_notes_con();
        this.notes_con = $("#search_results .tag-result.tag-"+this.id).get(0);
        return this.notes_con;
    },

    //此tag的便签容器是否存在
    notes_con_exists: function(){
        return $("#search_results .by-tag.result .tag-result.tag-"+this.id).length > 0;
    },

    //创建此tag便签容器
    create_notes_con: function(){
        $("#search_results .by-tag.result").append("<div class=\"tag-result tag-"+this.id+"\">");
        return $("#search_results .tag-result.tag-"+this.id).get(0);
    },

    //得到此tag下的便签
    get_notes: function(){
        var tag = this;
        var saved_notes;
        var saved_tag = APP.get_tag(this.id);

        if(saved_tag){
            if(saved_tag.name != "tasks"){
                saved_notes = APP.notes.filter(function(tmp_note){
                    if(tmp_note.tags && tmp_note.tags.length > 0){
                        for(var i=0,len=tmp_note.tags.length; i<len; i++){
                            if(tmp_note.tags[i] == tag.id && !!!tmp_note.deleted) return true;
                        }
                    }
                });
            }else{
                //得到既包含任务标签又有任务属性的note
                saved_notes = APP.notes.filter(function(tmp_note){
                    if(tmp_note.tags && tmp_note.tags.length > 0){
                        for(var i=0,len=tmp_note.tags.length; i<len; i++){
                            if(tmp_note.tags[i] == tag.id && tmp_note.task_id > 0 && !!!tmp_note.deleted) return true;
                        }
                    }
                });
            }
        }else{
            //得到所有未被删除的笔记
            saved_notes = APP.notes.filter(function(tmp_note){
                if(!!!tmp_note.deleted) return true;
            });

        }
        
        return saved_notes;
    },

    get_localdb_con: function(){
        //之前未定义过，则创建
        if(localStorage["tag_"+this.id] === undefined){
            var con = {
                notes: new Array()
            };
            localStorage["tag_"+this.id] = JSON.stringify(con);
        }

        return localStorage["tag_"+this.id];
    },

    save_note: function(note_id){
        var localdb_con = this.get_localdb_con();
        if(typeof localdb_con == "string") localdb_con = JSON.parse(localdb_con);
        localdb_con.notes.push(note_id);
        localStorage["tag_"+this.id] = JSON.stringify(localdb_con);
    },

    del_note: function(note_id){
        var localdb_con = this.get_localdb_con();
        if(typeof localdb_con == "string") localdb_con = JSON.parse(localdb_con);

        var notes = localdb_con.notes;
        if(notes.indexOf(note_id) !== -1){
            notes.splice(notes.indexOf(note_id),1);
        }

        localStorage["tag_"+this.id].notes = JSON.stringify(notes);
    },

    //由标签的名称获得标签对象
    get_tag_by_tagname: function(tagname){
        var tags = $.parseJSON(localStorage.tags);
        var tag = null;

        if(tags && $.isArray(tags)){
            var matched = tags.filter(function(tmp_tag){
                return tmp_tag.name == tagname;
            });

            if(matched && matched.length > 0){
                return new Tag(matched[0])
            }
        }
        return null;
        // for(var i=0,len=tags.length; i<len; i++){
        //     tag = tags[i];
            
        //     if(tag["name"] == tagname){
        //         return new Tag(tag);
        //     }
        // }
    },

    get_tag_by_id: function(tag_id){
        var tags = $.parseJSON(localStorage.tags);
        var tag = null;

        if(tags && $.isArray(tags)){
            var matched = tags.filter(function(tmp_tag){
                return tmp_tag.id == tag_id;
            });

            if(matched && matched.length > 0){
                return new Tag(matched[0])
            }
        }
        return null;
    },

    setColor: function(colorVal,callback){
    	if($.isFunction(colorVal)){
    		callback = colorVal;
    		colorVal = null;
    	}else{
    		callback = $.isFunction(callback) ? callback : null;
    	}
    	
    	if(colorVal && this.is_valid("colorVal",colorVal)){
    		$.post(this.set_color_url,{type:"ajax",from:"web",tag_id:this.id,colorVal:colorVal},callback);
    	}else if(colorVal == null){
    		$.post(this.set_color_url,{type:"ajax",from:"web",tag_id:this.id,colorVal:"unset"},callback);
    	}
    },

    pinIt: function(callback){
        var saved_tag = APP.get_tag(this.id);
        saved_tag.pined = 1;
        APP.save_tags();
    	callback = $.isFunction(callback) ? callback({status:"ok"}) : null;
    },

    unpinIt: function(callback){
    	var saved_tag = APP.get_tag(this.id);
        saved_tag.pined = 0;
        APP.save_tags();
        callback = $.isFunction(callback) ? callback({status:"ok"}) : null;
    },

    updateAccess: function(callback){
    	callback = $.isFunction(callback) ? callback : null;
    	$.post(this.update_access_url,{type:"ajax",from:"web","tag_id":this.id},callback);
    },

    altername: function(callback){
    	callback = $.isFunction(callback) ? callback : null;
    	var param = {id:this.id,name:this.name};
    	$.post(this.alter_name_url,{type:"ajax",from:"web","param":param},callback);
    },

    togglepublic: function(callback){
        if(this.is_valid("public",this.pub)){
            var param = {id:this.id,pub:this.pub};
            $.post(this.public_url,{type:"ajax",from:"web","param":param},callback);
        }
    },

    push: function(callback){
    	callback = $.isFunction(callback) ? callback : null;
    	if(this.is_valid("id",this.id)){
	    	var param = {tag_id:this.id};
	    	$.post(this.push_url,{type:"ajax",from:"web",param:param},callback);
    	}
    },

    unpush: function(callback){
    	callback = $.isFunction(callback) ? callback : null;
    	if(this.is_valid("id",this.id)){
	    	var param = {tag_id:this.id};
	    	$.post(this.unpush_url,{type:"ajax",from:"web",param:param},callback);
    	}
    },

    remove_from_issue: function(callback){
    	callback = $.isFunction(callback) ? callback : null;
    	if(this.is_valid("isid",this.isid) && this.is_valid("id",this.id)){
    		var param = {
    			tag_id: this.id,
    			isid: this.isid
    		};

    		$.post(this.remove_issue_url,{type:"ajax",from:"web",param:param},callback);
    	}
    	return this;
    },

    bulk_attach_tag: function(ids,callback){
    	callback = $.isFunction(callback) ? callback : null;

    	if($.isArray(ids) && ids.length > 0){
    		if(console) console.log(ids);
    		var param = {
    			bids: ids,
    			tid: this.id
    		};

    		$.post(this.bulk_attach_url,{type:"ajax",from:"web",param:param},callback);
    	}
    	return this;
    },

    del: function(callback){
    	callback = $.isFunction(callback) ? callback : null;
    	var that = this;

        if(this.is_valid("id",this.id)){
            $(APP.tags).each(function(idx,tag){
                if(tag.id == that.id){
                    APP.tags.splice(idx,1);
                    return false;
                }
            });

            APP.save_tags();
            if(callback && $.isFunction(callback)) callback({status:"ok"});
    	}else{
            if(callback && $.isFunction(callback)) callback({status:"error"});
        }
    },

    is_valid: function(field,value){
        switch(field){
            case "id": return $.isNumeric(value) && isFinite(value);break;
            case "isid": return $.isNumeric(value) && isFinite(value);break;
            case "name": return $.type(value) == "string" && value!="";break;
            case "public": return (parseInt(value) === 1 || parseInt(value) === 0 );break;
            case "colorVal": return /^\#(\w\w\w|\w\w\w\w\w\w)$/.test(value);
            default: return false;break;
        };
    },

    param : {
        optional : ["id"],
        required : ["name"]
    }
};


var ImageItem = function(o){
	this.id = o.id || 0;
	this.url = o.url || "";
	this.width = o.width || 0;
	this.height = o.height || 0;
}

ImageItem.prototype = {
	url_lib: {
		load_images:"/image/load_images",
		get_image_tags: "/image/get_image_tags",
		exclude: "/image/exclude",
        bulk_exclude: "/image/bulk_exclude"
	},

	//加载所有图片数据
	load_images: function(tag_id,callback){
		if(isNaN(tag_id) && $.isFunction(tag_id)){
			callback = tag_id;
			tag_id = 0;
		}

		if(isNaN(tag_id)) return false;
		callback = $.isFunction(callback) ? callback : null;
		$.post(this.url_lib["load_images"],{type:"ajax",from:"web",tag_id:tag_id},callback);
	},

	//得到所有图片tag
	get_image_tags: function(callback){
		callback = $.isFunction(callback) ? callback : null;
		$.post(this.url_lib["get_image_tags"],{type:"ajax",from:"web"},callback);
	},

	//删除
	exclude: function(callback){
		callback = $.isFunction(callback) ? callback : null;
		$.post(this.url_lib["exclude"],{type:"ajax",from:"web",image_id:this.id},callback);
	},

    //批量删除
    bulk_exclude: function(exclude_ids,callback){
        if(!$.isArray(exclude_ids) || exclude_ids.length == 0) return false;
        callback = $.isFunction(callback) ? callback : null;
        $.post(this.url_lib["bulk_exclude"],{type:"ajax",from:"web",exclude_ids:exclude_ids},callback);
    },

	//单张分享
	share: function(callback){

	},

	//多张分享
	bulk_share: function(callback){

	},
	
	//单张下载
	download: function(callback){

	},

	//多张下载
	buld_download: function(callback){

	}
};

var Post = function(o){
	this.id = o.id || 0;
	this.type = o.type || "";
    this.hash = o.hash || "";
	this.items = o.items || new Array();

}

Post.prototype = {
	url_lib: {
        publish: "/post/publish",
        report: "/post/report",
	},
    types: ["image"],

	publish: function(callback){
        callback = $.isFunction(callback) ? callback : null;

        if(this.is_valid("items",this.items) && this.is_valid("type",this.type)){
            $.post(this.url_lib["publish"],{type:"ajax",from:"web",items:this.items,post_type:this.type},callback);
        }
	},

    report: function(cat,type,callback){
        callback = $.isFunction(callback) ? callback : null;

        $.post(this.url_lib["report"],{type:"ajax",from:"web",cat:cat,post_type:type,hash:this.hash,post_id:this.id},callback);
    },

    is_valid: function(field,value){
        switch(field){
            case "type": return $.inArray(value,this.types) != -1;break;
            case "items": return $.isArray(value);break;
            default: return false;
        }
    }
};


var Note = function(o){
    this.title = o.title || "";
    this.id = o.id || 0;
    this.content = o.content || "";
    this.finished = o.finished || 0;
    this.deadline = o.deadline || 0;
    this.is_deleted = o.is_deleted || false;
    this.create_time = o.create_time || 0;
    this.task_id = o.task_id || 0;
    this.is_task = o.is_task || false;
    this.is_today = o.is_today || false;
    this.colored_tags = o.colored_tags || null;
    this.position = o.position || null;
    this.source = o.source || null,
    this.tags = o.tags || null;

    this.get_title = function(){
        return this.title;
    };

    this.get_content = function(){
        return this.content;
    };

    this.get_notebook = function(){

    };
    return this;
};

Note.prototype = {
	at_url : "/note/at",
	share_insite_url : "/note/share_insite",
    save_url : "/note/save",
    update_url : "/note/save",
    del_url: "/note/del",
    finish_url: "/note/finish",
    recover_url: "/note/recover",
    search_url: "/note/search",
    set_order_url: "/note/config_display_order",
    set_order_beta_url: "/note/config_display_order_beta",
    set_task_url: "/note/set_task",
    unset_task_url: "/note/unset_task",
    set_deadline_url: "/note/set_deadline",
    move_today_url: "/note/move_to_today",
    move_later_url: "/note/move_to_later",
    load_more_url: "/note/load_more",
    save_last_opened_url: "/note/save_last_opened",
    fetch_url: "/note/fetch_new",
    fetch_in_tag_url: "/note/fetch_tag_new",
    check_cache_status_url: "/note/check_cache_uptodate",
    classify_url: "/note/classify",
    add_tag_url: "/note/add_tag",
    remove_tag_url: "/note/remove_tag",
    get_info_url: "/note/get_info",
    get_tag_ids_url: "/note/get_tag_ids",
    get_num_in_tag_url: "/note/get_num_in_tag",
    load_finished_url: "/note/load_finished",
    get_dates_url: "/note/get_active_dates",
    get_recent_dates_url: "/note/get_recent_dates",
    get_recent_devices_url: "/note/get_recent_devices",
    get_notes_loc_url: "/note/get_notes_loc",
    get_notes_by_ids_url: "/note/get_notes_by_ids",
    get_history_url: "/note/get_notes_by_time",
    get_notes_by_device_url: "/note/get_notes_by_device",
    get_archived_url:"/note/get_archived_notes",//可选择需要排除的id
    load_archived_url: "/note/load_from_archive",//一次性全部加载
    get_in_tag_url: "/note/get_notes_in_tag",
    add_coords_url: "/note/add_coords",
    copy_buzz_url: "/note/copy_buzz",
    remove_buzz_url: "/note/remove_buzz",
    save_img_url: "/note/save_img",
    save_link_url: "/note/save_link",
    properties : ["id","tag_id","tag","content"],
    all_saved_con : ".all",
    finished_html: "",
    order: 0,
    limit: 10,
    param : {
        optional : ["notebook","id","content"],
        required : ["content"]
    },

    checkParam : function(){
        var valid = true;
        if((this.content == "" && this.title == "") || isNaN(this.id)){
            valid = false;
        }
        var required_params = this.param.required;
        for(var i=0,len=required_params.length;i<len;i++){
            if(!this[required_params[i]]){
                valid = false;
            }
        }
        return valid;
    },

    //分享便签给他人
    at: function(pal_ids,callback){
    	callback = $.isFunction(callback) ? callback : null;

    	for(var i=0; i<pal_ids.length; i++){
    		var pal = pal_ids[i];
    		if(isNaN(pal.pal_id) || (pal.team_id && isNaN(pal.team_id))) return false;
    	}

    	$.post(this.at_url,{type:"ajax",from:"web",pal_ids:pal_ids,note_id:this.id},callback);
    },

    share_insite: function(text,callback){
    	callback = $.isFunction(callback) ? callback : null;

    	$.post(this.share_insite_url,{type:"ajax",from:"web",text:text,note_id:this.id},callback);
    },

    //检查是否有新的通知便签，返回结果条数
    check_buzzs: function(){

    },

    //拷贝分享的便签
    copy_buzz: function(uid,callback){
    	callback = $.isFunction(callback) ? callback : null;

    	if(this.is_valid("id",uid) && this.is_valid("id",this.id)){
    		$.post(this.copy_buzz_url,{type:"ajax",from:"web",uid:uid,id:this.id},callback);
    	}
    },

    //删除通知便签
    remove_buzz: function(uid,callback){
    	callback = $.isFunction(callback) ? callback : null;

    	if(this.is_valid("id",uid) && this.is_valid("id",this.id)){
    		$.post(this.remove_buzz_url,{type:"ajax",from:"web",uid:uid,id:this.id},callback);
    	}
    },

    //删除所有通知便签
    remove_all_buzzs: function(){

    },

    change_task_position: function(srcpos,dstpos){
        var saved_tasks = APP.tasks,task = null,position = 0;
        if(srcpos < dstpos){
            for(var i=0,len=saved_tasks.length; i<len; i++){
                task = saved_tasks[i];
                position = task.position;
                if(position >= srcpos && position <= dstpos){
                    if((position - 1) < srcpos){
                        //他自己
                        task.position = dstpos;
                    }else{
                        //position在它上面的任务
                        task.position = position - 1;
                    }
                }
            }
        }else{
            for(var i=0,len=saved_tasks.length; i<len; i++){
                task = saved_tasks[i];
                position = task.position;
                if(position >= srcpos && position <= dstpos){
                    if((position + 1) > srcpos){
                        //他自己
                        task.position = dstpos;
                    }else{
                        //position在它上面的任务
                        task.position = position + 1;
                    }
                }
            }
        }

        APP.save_tasks();
    },

    //得到任务期限为今日或今日之前且未完成未删除的任务 
    get_last_today_task: function(){
        var saved_tasks = APP.tasks;
        if(saved_tasks && saved_tasks.length > 0){
            var today_tasks = saved_tasks.filter(function(tmp_task){
                return !!!(tmp_task.finished) && !!!(tmp_task.deleted) && !!tmp_task.deadline && get_formated_time(tmp_task.deadline,false) <= get_formated_time(Date.now(),false);
            });

            if(today_tasks){
                if(today_tasks.length ==1 ){
                    return today_tasks[0];
                }else{
                    today_tasks.sort(function(a,b){
                        if(a.position > b.position) return 1;
                        else return -1;
                    });

                    return today_tasks[0];
                }
            }
        }

        return null;
    },

    //传入格式为 2013-04-30 23：03：32时间参数以及回调函数
    setTask: function(callback){
    	var note = this;
    	if(this.is_valid("end_date",this.deadline)){
            var saved_tasks = APP.tasks;            

            //先为即将创建的任务给一个最高的position,
            //之后再放入以后区域
            saved_tasks.sort(function(a,b){
                if(a.position > b.position) return -1;
                else return 1;
            });

            var top_position=0,right_position=0;
            
            if(saved_tasks.length > 0){
                top_position = saved_tasks[0].position + 1;
            }

            var task = {
                id: saved_tasks.length+1,
                deadline: note.deadline ? note.deadline : null,
                position: -1,
                created: get_current_time(),
                created_stamp: Date.now(),
                finished: null,
                modified: null,
                deleted: null
            };
            
            APP.check_integrity('tasks');
            APP.tasks.push(task);

            //保存到本地数据库
            APP.save_tasks();

            //为便签保存任务属性
            var saved_note = APP.get_note(this.id);
            saved_note.task_id = task.id;
            APP.save_notes();

            //更新本地存储tasks位置
            var right_position = this.move_to_later();
    	}

        $.isFunction(callback) ? callback({task_id:task.id,position:right_position,status:"ok"}) : null;
        return {task_id:task.id,position:right_position};
    },

    //将某条任务，新建的或者是已经存在的任务放入以后任务中
    move_to_later: function(){
        var saved_tasks = APP.tasks;            

        //先为即将创建的任务给一个最高的position,
        //之后再放入以后区域
        saved_tasks.sort(function(a,b){
            if(a.position > b.position) return -1;
            else return 1;
        });

        var top_position=0,right_position=0;
        
        if(saved_tasks.length > 0){
            top_position = saved_tasks[0].position + 1;
        }

        //更新本地存储tasks位置
        var last_today_task = this.get_last_today_task();
        var saved_note = APP.get_note(this.id);
        var saved_task = APP.get_task(saved_note.task_id);

        //位置为-1，新创建的，或者是恢复完成的任务
        if(saved_task.position == -1){
            //没有原位置的任务
            //先把此条任务放到任务列表的最上方，再通过change_task_position将其移动到今日列表之后
            saved_task.position = top_position;
            //直接由最上面放入以后任务
            var src_position = top_position;
        }else{
            //由原位移动到以后任务
            var src_position = saved_task.position;
        }

        if(last_today_task){
            right_position = last_today_task.position;
            this.change_task_position(src_position,right_position);
        }else{
            right_position = top_position;
            if(saved_task.position != -1) this.change_task_position(src_position,right_position);

            saved_task.position = right_position;
            APP.save_tasks();
        }

        return right_position;
    },

    //将任务放到最上方
    move_to_today: function(){
        var saved_note = APP.get_note(this.id);
        var saved_task = APP.get_task(saved_note.task_id);

        var saved_tasks = APP.tasks;            

        saved_tasks.sort(function(a,b){
            if(a.position > b.position) return -1;
            else return 1;
        });

        var top_position=0;
        
        if(saved_tasks.length > 0){
            top_position = saved_tasks[0].position + 1;
        }
        console.log(top_position);
        if(saved_task.position != -1){
            this.change_task_position(saved_task.position,top_position);
            return top_position;
        }
    },

    unsetTask: function(callback){
    	callback = $.isFunction(callback) ? callback : null;
        
    	if(this.is_valid("id",this.id) && this.is_valid("task_id",this.task_id)){
            var note = this;
            var saved_note = APP.get_note(this.id);
            saved_note.task_id = null;
            this.task_id = null;
            APP.save_notes();

            if($.isFunction(callback)) callback({status:"ok"});

            var index = null;
            var task_to_delete = APP.tasks.filter(function(task,i){
                if(task.id == note.id){
                    index = i;
                    return task.id == note.id;
                }
            });

            if(task_to_delete && index !== null){
                APP.tasks[index] = null;
                APP.tasks.splice(index,1);

                //保存到本地数据库
                APP.save_tasks();
            }
    	}
    },

    moveToLater: function(callback){
    	callback = $.isFunction(callback) ? callback : null;

    	if(this.is_valid("id",this.id)){
    		$.post(this.move_later_url,{type:"ajax",from:"web",note_id:this.id},callback);	
    	}
    },

    moveToToday: function(callback){
    	callback = $.isFunction(callback) ? callback : null;
    	if(this.is_valid("id",this.id)){
    		$.post(this.move_today_url,{type:"ajax",from:"web",note_id:this.id},callback);	
    	}
    },

    setDeadline: function(set_position,callback){
    	var note = this;
    	var params;
        var saved_note = APP.get_note(note.id);
        var saved_task = APP.get_task(saved_note.task_id);
        callback = $.isFunction(set_position) ? set_position : callback;

    	if(this.is_valid("id",this.id) && this.is_valid("deadline",this.deadline)){

    		if(set_position === false){
	    		//不自动给上顺序，只更改deadline即可
                saved_task.deadline = this.deadline;
                APP.save_tasks();
                callback = $.isFunction(callback) ? callback({status:"ok"}) : null;
	    		// params = {type:"ajax",from:"web",id:this.id,deadline:this.deadline,set_position:false};
	    		// callback = $.isFunction(callback) ? callback : null;
	    	}else{

                var ori_deadline = saved_task.deadline;
                saved_task.deadline = this.deadline;
                var today = get_formated_time(Date.now());
                //设定任务期限有两种情况:1.去掉任务期限,2.重设任务期限(设为今日，设为以后)

                if(this.deadline == null){
                    //去掉任务期限，
                    //如果原任务期限为今日或今日之前的话，则将任务放入到以后任务
                    if(!!ori_deadline && ori_deadline <= today){
                        var position = this.move_to_later();
                    }
                    $.isFunction(callback) ? callback({status:"ok",position:position}) : null;
                    //否则原地不动
                }else{
                    //重设任务期限，
                    if(this.deadline == today){
                        //如果设为今日，则原任务期限必定是以后，所以应该将任务移动至今日区域
                        var position = this.move_to_today();
                        $.isFunction(callback) ? callback({status:"ok",position:position}) : null;
                    }else if(this.deadline > today){
                        //如果设为以后某一天，只有在原任务期限小于或等于今日时才移动位置
                        if(!!ori_deadline && ori_deadline <= today){
                            var position = this.move_to_later();
                        }
                        $.isFunction(callback) ? callback({status:"ok",position:position}) : null;
                    }
                }

                APP.save_tasks();
	    		// params = {type:"ajax",from:"web",id:this.id,deadline:this.deadline};
	    		// callback = $.isFunction(set_position) ? set_position : null;
	    	}
    	}
    },

    set_display_order: function(order_str,callback){
    	callback = $.isFunction(callback) ? callback : null;
    	if(this.is_valid("order_str",order_str)){
    		$.post(this.set_order_url,{type:"ajax",from:"web",order_str:order_str},callback);
    	}
    },

    set_display_order_beta: function(srcindex,dstindex,callback){
    	callback = $.isFunction(callback) ? callback : null;
        
    	$.post(this.set_order_beta_url,{type:"ajax",from:"web","srcindex":srcindex,"dstindex":dstindex},callback);
    },

    save: function(callbefore,callback){
        if(arguments.length == 2){
            if(jQuery.isFunction(callbefore)){
                callbefore.call(this);
            }
        }else if(arguments.length == 1){
            callback = callbefore;
        }else{
            callback = function(){};
        }

        return (this.id && this.id>0) ? this.update(callback) : this.create(callback);
    },

    create: function(callback){
        if(this.checkParam()){
            //存入localStorage.notes，保存成功之后再存入tag便签容器中
            var device = APP.get_device().toString();

            var notes = APP.notes;
            var tag_ids = new Array();
            
            if(this.tags && this.tags.length > 0){
                var tmp_tag;
                for(var i=0,len=this.tags.length; i<len; i++){
                    tmp_tag = Tag.prototype.get_tag_by_tagname(this.tags[i]);
                    if(tmp_tag) tag_ids.push(tmp_tag.id);
                }
            }

            var new_note = {
                id: notes.length+1,
                title: this.title ? this.title : get_title(this.content),
                content: this.content,
                device: device,
                created: get_current_time(),
                created_stamp: Date.now(),
                modified: null,
                deleted: null,
                task_id: 0,
                tags: tag_ids,
                location: "",
                device: "",
                source: this.source ? this.source : null
            };
            
            new_note.device = device;
            APP.check_integrity('notes');
            APP.notes.push(new_note);
            APP.save_notes();
            //localStorage.notes = JSON.stringify(notes);
            var feedback = {
                status: "ok",
                id: new_note.id
            };
            $("#title_sec").removeClass("alert").offset();
            $("#title_sec").addClass("alert");
            $.isFunction(callback) ? callback(feedback) : null;
        }
    },

    _save_image: function(img){
        //APP.images
        var images = APP.images;
        var note = this;
        //先判断是否同一个便签存在同一个大小相同链接也相同的图片，存在的话则不加入
        var img_exists = images.filter(function(tmp_image){
            return tmp_image.width == img.width && tmp_image.height == img.height && tmp_image.note_id == note.id && tmp_image.url == img.url;
        });

        if(img_exists && img_exists.length > 0) return img_exists.id;

        var new_img = {
            id: images.length + 1,
            note_id: note.id,
            url: img.url,
            width: img.width,
            height: img.height,
            excluded: 0,
            created: get_current_time(),
            created_stamp: Date.now()
        };

        APP.check_integrity('images');
        APP.images.push(new_img);
        APP.save_images();
    },

    _save_link: function(link){
        var links = APP.links;
        var note = this;
        //先判断是否同一个便签存在同一个链接，存在的话则不加入
        var link_exists = links.filter(function(tmp_link){
            return tmp_link.note_id == note.id && tmp_link.url == link.url;
        });

        if(link_exists && link_exists.length > 0) return link_exists.id;

        var new_link = {
            id: links.length + 1,
            note_id: note.id,
            url: link.url,
            title: "",
            created: get_current_time(),
            created_stamp: Date.now()
        };

        APP.check_integrity('links');
        APP.links.push(new_link);
        APP.save_links();
    },

    add_tag_by_names: function(tagnames,callback){
        callback = $.isFunction(callback) ? callback : null;
        var task_info = null;
        var feedback = {status:"error"};
        var tagname = tag = null;
        if($.isArray(tagnames)){
            for(var i=0,len=tagnames.length; i<len; i++){
                tagname = tagnames[i];
                tag = Tag.prototype.get_tag_by_tagname(tagname);
                if(tagname == "tasks"){
                    this.deadline = null;
                    task_info = this.setTask();
                }
                if(tag) this.addTag(tag.id);
            }

            feedback.status = "ok";
            if(task_info){
                feedback.task_id = task_info.task_id;
                feedback.position = task_info.position;
            }
            if(callback) callback(feedback);
        }
    },

    //用户自定义的标签不在此处添加，这里只负责分类，分为五大类:任务，记事，图片，连接，联系(邮箱或电话号码或地址)
    classify: function(default_type,callback){
    	callback = $.isFunction(callback) ? callback : null;
		var stick_types = new Array(),note = this;
			this.hasImage = false;

        //添加稍后阅读标签
        if(note.readslater && default_type != "readslater") stick_types.push("readslater");

        var that = this;
		//在默认面板中添加
		if(default_type != "all" && default_type != "custom"){
			if(!note.readslater) stick_types.push(default_type);
		}

		//当前不在任务面板，也不在记事面板，则默认归类为记事
		// if(default_type != "tasks" && default_type !="notes"){
		// 	stick_types.push("notes");
		// }

        //添加新记事成功，对其内容进行进一步处理
        if(link_regexp.test(this.content) || ip_link_regexp.test(this.content)){
        	//添加链接标签
        	// if($.inArray("links",stick_types) === -1) stick_types.push("links");
        	var links = this.content.match(link_regexp);
            
        	//若匹配到了ip链接地址，也添加进去
        	if(ip_link_regexp.test(this.content)){
        		var ip_links = this.content.match(ip_link_regexp);
        		links.concat(ip_links);
        	}
        	
        	var len = links.length;
        	var link = "";

        	for(var i=0; i<len; i++){
				link = links[i];
				if(link.indexOf("://") === -1){
					link = "http://"+link;
				}

				is_image_url(link,function(url,img){
					if(img){
						if(!that.hasImage){
							that.hasImage = true;

                            //保存到本地添加图片tag
                            that.add_tag_by_names(["images"],function(data){
                                if(callback) callback({types:["images"],data:data});
                            });
						}

						//保存此图片链接，尺寸
						var img_obj = {
							url: url,
							width: img.width,
							height: img.height
						};

                        //本地保存图片
						that._save_image(img_obj);
					}else{
                        if(!that.hasLink){
                            that.hasLink = true;

                            //保存到本地添加图片tag
                            that.add_tag_by_names(["links"],function(data){
                                if(callback) callback({types:["links"],data:data});
                            });
                        }

						var link_obj = {
							url: url
						};

                        //找到了链接，看标题是否能找到，找到了则添加title属性
                        var reg = new RegExp("<a[^><]{0,}href\=[\"\']?("+url+")[\"\']?[^><]{0,}\>([^><]{0,})(?:\<\/a\>)?");
                        var link_matches = that.content.match(reg);
                        if(link_matches && link_matches.length > 0){
                            var link_title = link_matches[2];
                            if(link_title){
                                link_obj.title = link_title;
                            }
                        }

                        //本地保存链接
						that._save_link(link_obj);
					}
				});
        	}
        }

        if(is_contact(this.content)>0){
            //添加联系标签
            if($.inArray("contacts",stick_types) === -1) stick_types.push("contacts");
        }
        
        if(stick_types.length > 0){
            //保存到本地添加tag
        	that.add_tag_by_names(stick_types,function(data){
        		if(callback) callback({types:stick_types,data:data});

        		var response = data;
        		if(response.status == "ok"){
                    //附上任务的信息
                    if(response.task_id && response.task_id > 0){
                        //将任务id加入便签中
                        var note_con = $(".note-con[data-id=\""+note.id+"\"]").get(0);

                        //先将新建任务的position设为最高，再change_position("down",pos,response.position)
                        var initpos = $(".task.note-con").not(".newly_saved").first().data("position");
                        
                        if(!initpos){
                            initpos = 1;
                        }else{
                            initpos++;
                        }

                        if(initpos){
                            $(note_con).data({"task-id":response.task_id,"position":initpos}).attr({"data-task-id":response.task_id,"data-position":initpos});

                            //当存在今日任务的时候才进行改序，若只有以后任务，则直接放在最上方，无需改序
                            if(response.position && initpos > response.position){
                                change_position("down",initpos,response.position);
                            }
                        }
                        
                        //recount_today_tasks("addnew");
                    }

        			if(!!parseInt(APP._evgranted)){
	        			//同步到evernote，同步tag
	        			// $.post("/note/evsync",{id:note.id,oper:"tag"},function(data){
	        			// 	console.log(data);
	        			// });
        			}
        		}
        	});
        }

    	return stick_types;
    },

    

    update: function(callback){
        //find all properties that have been set
        //if there is only one property has been set, we just change that one
        //else we request update method on the server
        var properties = this.properties,updatems = new Array();
        for(var i=0,len = properties.length; i<len; i++){
            if(this[properties[i]] && properties[i] != "id"){
                updatems.push(properties[i]);
            }
        }

        if(updatems.length == 1){
            var item = updatems[0];
            switch(item){
                case "content": return this.updateContent(callback);break;
                case "tag_id": return this.addTag(callback);break;
                case "deadline": return value.match(/^\d{4}\-\d{1,2}\-\d{1,2}$/);break;
                case "tag": return this.addTag(callback);break;
                default: return false;break;
            }
        }
        return false;
    },

    updateContent: function(callback){
    	var note = this;

        if(this.is_valid("content",this.content)){
            var saved_note = APP.get_note(this.id);

            if(saved_note){
                saved_note.content = note.content;
                saved_note.modified = get_current_time();
                APP.save_notes();
                var data = {
                    status: "ok"
                };
                $.isFunction(callback) ? callback(data) :null;
            }
        }
    },

    add_coords: function(coords,callback){
    	callback = $.isFunction(callback) ? callback : null;
    	var note = this;
    	if(this.is_valid("coords",coords)){
    		$.post(this.add_coords_url,{type:"ajax",from:"web",id:this.id,coords:coords},function(data){
    			if($.isFunction(callback)){
            		callback(data);
            	}
    		});
    	}
    },

    addTag: function(tag_id,callback){
    	callback = $.isFunction(callback) ? callback : null;
    	var that = this;
    	if(this.is_valid("id",this.id) && this.is_valid("tag_id",tag_id)){
            if(APP.notes){
                //得到所有便签
                var notes = APP.notes;

                //得到本条便签
                if($.isArray(notes)){
                    var note = notes.filter(function(tmp_note,i,notes_arr){
                        return tmp_note.id == that.id;
                    });

                    if(note && note.length > 0 && $.isArray(note[0].tags)){
                        note[0].tags.push(tag_id);
                        $.unique(note[0].tags);
                    }

                    //保存
                    //localStorage.notes = JSON.stringify(notes);
                    APP.save_notes();

                    var data = {status:"ok"};
                    if(callback) callback(data);
                }
            }

    	}
    },

    removeTag: function(tag_id,callback){
    	var note = this;
    	if(this.is_valid("id",this.id) && this.is_valid("tag_id",tag_id)){
            var saved_note = APP.get_note(this.id);
            if(saved_note && saved_note.tags){
                var idx = saved_note.tags.indexOf(tag_id);
                if(idx >= 0){
                    saved_note.tags.splice(idx,1);
                    APP.save_notes();
                    $.isFunction(callback) ? callback({status:"ok"}) : null;
                }
            }
    	}
    },

    del: function(callback){
    	var note = this;

    	if(this.is_valid("id",this.id)){
    	   	var saved_note = APP.get_note(this.id);
            saved_note.deleted = get_current_time();
            saved_note.modified = get_current_time();
            APP.save_notes();
            if(saved_note.task_id > 0){
                var task = APP.get_task(saved_note.task_id);
                task.position = -1;
                task.deleted = get_current_time();
                task.modified = get_current_time();
                APP.save_tasks();
            }

            $.isFunction(callback) ? callback({status:"ok"}) : null;
    	}
    },

    finish: function(callback){
    	var note = this;
    	if(this.is_valid("id",this.id)){
    		var saved_note = APP.get_note(this.id);
            var task = APP.get_task(saved_note.task_id);
            if(task){
                task.finished = get_current_time();
                task.modified = get_current_time();
                //finished，position设为-1
                task.position = -1;
                APP.save_tasks();

                callback = $.isFunction(callback) ? callback({status:"ok"}) : null;
            }
    	}
    },

    recover: function(callback){
    	callback = $.isFunction(callback) ? callback : null;
    	var note = this;
    	if(this.is_valid("id",this.id)){
    		var saved_note = APP.get_note(this.id);
            var task = APP.get_task(saved_note.task_id);
            if(task){
                task.finished = null;
                task.modified = get_current_time();
                task.deadline = null;
                APP.save_tasks();
                
                //position要重新设置，放到今日以后
                this.move_to_later();


                callback = $.isFunction(callback) ? callback({status:"ok"}) : null;
            }
    	}
    },

    addBlank : function(){
        var blank_note = "<div class=\"note-con new\">"+
                "<form class=\"note\">"+
                    "<div class=\"input-con\">"+
                    "<div class=\"field-con\">"+
                        "<div class=\"note editable expand70-600\" data-value=\"\" data-tooltip=\""+_translate("alt_new_memo")+"\" spellcheck=false contenteditable=\"true\" tabIndex=\"-1\"></div>"+
                    "</div>"+
                    "<div class=\"checkbox\"><span class=\"ok-icon-checked icon-font\"></span></div>"+
                    "<div class=\"bottom\">"+
                         "<div class=\"btn-con\">"+
                            "<a href=\"#\" class=\"submit\">OK</a><p class=\"hint\">Tips：你可以Ctrl+S保存。</p></div>"+
                        "</div>"+
                    "</div>"+
                "</form>"+
                "<div class=\"strips\"></div>"+
                "</div>";

        $("#blank_sheet").prepend(blank_note);
    },


    /*----------------- 取 -------------------*/
    fetch: function(last_refresh,callback){
    	callback = $.isFunction(callback) ? callback : null;
    	$.get(this.fetch_url,{"last_refresh":last_refresh},callback);
    },

    fetch_in_tag: function(tag_id,last_refresh,callback){
    	callback = $.isFunction(callback) ? callback : null;
    	$.get(this.fetch_in_tag_url,{"last_refresh":last_refresh,"tag_id":tag_id},callback);
    },

    get_notes_in_tag: function(tag_id,limit,offset_id,callback){
    	limit = !!limit ? limit : this.limit;
    	callback = $.isFunction(callback) ? callback : null;
    	
    	if(this.is_valid("tag_id",tag_id)){
    		$.post(this.get_in_tag_url,{type:"ajax",from:"web",tag_id:tag_id,offset_id:offset_id,limit:limit},callback);
    	}
    },

    search: function(str,exclude_ids,limit,callback){
    	limit = !!limit ? limit : this.limit;
    	callback = $.isFunction(callback) ? callback : null;
    	//offset = !isNaN(offset) && isFinite(offset) ? offset : 0;
    	if(this.is_valid("search_str",str)){
    		$.post(this.search_url,{type:"ajax",from:"web",search_str:str,exclude_ids:exclude_ids,limit:limit},callback);
    	}
    },

    load_finished: function(limit,offset_id,callback){
    	limit = !!limit ? limit : this.limit;
    	callback = $.isFunction(callback) ? callback : null;
    	
    	$.post(this.load_finished_url,{type:"ajax",from:"web",offset_id:offset_id,limit:limit},callback);
    },

    load_archived: function(callback){
    	callback = $.isFunction(callback) ? callback : null;
    	$.get(this.load_archived_url,{type:"ajax",from:"web"},callback);
    },

    //得到便签是否是任务
    is_atask: function(){
        var saved_note = APP.get_note(this.id);
        var tag = Tag.prototype.get_tag_by_tagname("tasks")
        var has_task_tag = false;
        for(var i=0,len=saved_note.tags.length; i<len; i++){
            if(saved_note.tags[i] == tag.id){
                has_task_tag = true;
                break;
            }
        }

        if(saved_note.task_id > 0 && has_task_tag){
            this.is_task = true;
            var task = APP.get_task(saved_note.task_id);
            if(task) this.deadline = task.deadline;
            return true;
        }
        return false;
    },

    get_colored_tags: function(){
        var tag = null,colored_tags=new Array();
        if(this.tags && this.tags.length > 0){
            for(var i=0,len=this.tags.length; i<len; i++){
                tag = APP.get_tag(this.tags[i]);
                if(tag.color) colored_tags.push(new Tag(tag));
            }
        }

        this.colored_tags = colored_tags;
    },

    construct_item: function(exclass){
        //给便签添加额外的类
        exclass = !!exclass ? " "+exclass : "";

        //得到默认tag，及展示标签颜色值
        var str = default_class = today_class = default_tags_html = deadline_html = "",tag;
        if(this.id || this.createStamp){
            //得到default_tag只是为了表上颜色块
            //或者名字应该取为get_colored_tag，因为不只是default tag才有color
            //如果含有带有颜色的标签
            
            if(this.colored_tags && this.colored_tags.length > 0){
                default_class = " has-colored";
                
                for(var i=0,len = this.colored_tags.length; i<len; i++){ 
                    tag = this.colored_tags[i];
                    default_tags_html += "<div class=\"default_tag "+tag.name+"\" data-id=\""+tag.id+"\" style=\"background:"+tag.color+"\"></div>";
                }
            }

            var is_task_class = this.is_task ? " task" : "";
            
            if(this.is_task && this.deadline){
                var deaddate = this.deadline.split(" ")[0];
                deadline_html = "<div class=\"deadline\"><span>"+deaddate+"</span></div>";
                var today = get_formated_time(Date.now(),false);

                //今天的任务
                if(!!parseInt(this.is_today)){
                    today_class = " today";
                }else{
                    today_class = "";
                }
            }

            var top_menu_html = "<div class=\"top-ops\">"+
                                    "<a href=\"#\" class=\"clear-link\"><span data-i18ntooltip=\"alt_clear_link\" data-tooltip=\""+_translate("alt_clear_link")+"\" class=\"ok-icon-link icon-font\"></span></a>" +
                                    "<a href=\"#\" class=\"maximize-note\"><span data-i18ntooltip=\"alt_maximize_note\" data-tooltip=\""+_translate("alt_maximize_note")+"\" class=\"ok-icon-maximum icon-font\"></span></a>"+
                                    "<a href=\"#\" class=\"minimize-note\"><span data-i18ntooltip=\"alt_minimize_note\" data-tooltip=\""+_translate("alt_minimize_note")+"\" class=\"ok-icon-minimum icon-font\"></span></a>"+
                                "</div>";//7-13-删除了固定页面的按钮
            
            if(!parseInt(this.finished)){ //7-13-添加了字体图标
                if(this.is_task){
                    str = "<div class=\"note-con sortable task"+exclass+""+default_class+""+today_class+"\" id=\"note-"+this.id+"\" data-deadline=\""+(this.deadline ? this.deadline : 0)+"\" data-task-id=\""+(this.task_id > 0 ? this.task_id : 0)+"\" data-position=\""+this.position+"\" data-id=\""+this.id+"\">"+
                            "<form  class=\"note\"><div class=\"field-con\">"+
                            "<div class=\"entities-con\"><div class=\"img-entity\"></div></div>"+
                            "<div class=\"note editable expand0-150 loaded\" contenteditable=\"false\" tabIndex=\"-1\"  spellcheck=false >"+this.content+"</div>"+
                            "<div class=\"linear-gradient\"></div></div>"+
                            "<div class=\"checkbox\"><span class=\"ok-icon-checked icon-font\"></span></div>"+
                            "<div class=\"bottom-menu\">"+
                                "<div class=\"op\"><a href=\"#\" class=\"more\"></a></div>"+
                                "<div class=\"op exit\"><a href=\"#\" class=\"share\"><span data-i18ntooltip=\"alt_note_share\" data-tooltip=\""+_translate("alt_note_share")+"\" class=\"ok-icon-share icon-font\"></span></a></div>"+
                                "<div class=\"op hidden\"><a href=\"#\" class=\"del\"><span data-i18ntooltip=\"alt_note_delete\" data-tooltip=\""+_translate("alt_note_delete")+"\" class=\"ok-icon-delete icon-font\"></span></a></div>"+
                                "<div class=\"op hidden\"><a href=\"#\" class=\"cal\"><span data-i18ntooltip=\"alt_note_task\" data-tooltip=\""+_translate("alt_note_task")+"\" class=\"ok-icon-calendar icon-font\"></span></a></div>"+
                                "<div class=\"op hidden\"><a href=\"#\" class=\"tags\"><span data-i18ntooltip=\"alt_note_tags\" data-tooltip=\""+_translate("alt_note_tags")+"\" class=\"ok-icon-tages icon-font\"></span></a></div>"+
                                "<div class=\"op hidden\"><a href=\"#\" class=\"info\"><span data-i18ntooltip=\"alt_note_detail\" data-tooltip=\""+_translate("alt_note_detail")+"\" class=\"ok-icon-info icon-font\"></span></a></div></div>"+
                            "<a href=\"#\" class=\"drag_trigger sort_trigger\"><span class=\"icon-font ok-icon-drag\"></span></a>"+deadline_html+top_menu_html+"</form>"+"<div class=\"strips\">"+default_tags_html+"</div>"+"</div>";
                }else{
                    str = "<div class=\"note-con"+exclass+""+default_class+""+today_class+"\" id=\"note-"+this.id+"\" data-position=\""+this.position+"\" data-id=\""+this.id+"\">"+
                                "<form  class=\"note\"><div class=\"field-con\">"+
                                "<div class=\"entities-con\"><div class=\"img-entity\"></div></div>"+
                                    "<div class=\"note editable expand0-150 loaded\" contenteditable=\"false\" tabIndex=\"-1\"  spellcheck=false >"+this.content+"</div>"+
                                    "<div class=\"linear-gradient\"></div>"+
                                    "</div><div class=\"checkbox\"><span class=\"ok-icon-checked icon-font\"></span></div>"+
                                    "<div class=\"bottom-menu\"><div class=\"op\"><a href=\"#\" class=\"more\"></a></div>"+
                                    "<div class=\"op exit\"><a href=\"#\" class=\"share\"><span data-i18ntooltip=\"alt_note_share\" data-tooltip=\""+_translate("alt_note_share")+"\" class=\"ok-icon-share icon-font\"></span></a></div>"+
                                "<div class=\"op hidden\"><a href=\"#\" class=\"del\"><span data-i18ntooltip=\"alt_note_delete\" data-tooltip=\""+_translate("alt_note_delete")+"\" class=\"ok-icon-delete icon-font\"></span></a></div>"+
                                "<div class=\"op hidden\"><a href=\"#\" class=\"cal\"><span data-i18ntooltip=\"alt_note_task\" data-tooltip=\""+_translate("alt_note_task")+"\" class=\"ok-icon-calendar icon-font\"></span></a></div>"+
                                "<div class=\"op hidden\"><a href=\"#\" class=\"tags\"><span data-i18ntooltip=\"alt_note_tags\" data-tooltip=\""+_translate("alt_note_tags")+"\" class=\"ok-icon-tages icon-font\"></span></a></div>"+
                                "<div class=\"op hidden\"><a href=\"#\" class=\"info\"><span data-i18ntooltip=\"alt_note_detail\" data-tooltip=\""+_translate("alt_note_detail")+"\" class=\"ok-icon-info icon-font\"></span></a></div></div>"+
                                    "<a href=\"#\" class=\"drag_trigger sort_trigger\"><span class=\"icon-font ok-icon-drag\"></span></a>"+top_menu_html+"</form>"+"<div class=\"strips\">"+default_tags_html+"</div>"+
                            "</div>";
                }
            }else{
                str = "<div class=\"note-con hidden"+is_task_class+""+exclass+""+default_class+""+today_class+"\" id=\"note-"+this.id+"\" data-deadline=\""+(this.deadline ? this.deadline : 0)+"\" data-task-id=\""+(this.task_id > 0 ? this.task_id : 0)+"\" data-position=\""+this.position+"\" data-id=\""+this.id+"\">"+
                            "<form class=\"finished note\">"+
                                "<div class=\"field-con\">"+
                                "<div class=\"entities-con\"><div class=\"img-entity\"></div></div>"+
                                "<div class=\"note editable expand0-150 loaded\" contenteditable=\"false\" tabIndex=\"-1\"  spellcheck=false >"+this.content+"</div>"+
                                "<div class=\"linear-gradient\"></div></div>"+
                                "<div class=\"checkbox checked\"><span class=\"ok-icon-checked icon-font\"></span></div>"+
                                "<div class=\"bottom-menu\">"+
                                    "<div class=\"op\"><a href=\"#\" class=\"more\"></a></div>"+
                                    "<div class=\"op exit\"><a href=\"#\" class=\"share\"><span data-i18ntooltip=\"alt_note_share\" data-tooltip=\""+_translate("alt_note_share")+"\" class=\"ok-icon-share icon-font\"></span></a></div>"+
                                    "<div class=\"op hidden\"><a href=\"#\" class=\"del\"><span data-i18ntooltip=\"alt_note_delete\" data-tooltip=\""+_translate("alt_note_delete")+"\" class=\"ok-icon-delete icon-font\"></span></a></div>"+
                                    "<div class=\"op hidden\"><a href=\"#\" class=\"cal\"><span data-i18ntooltip=\"alt_note_task\" data-tooltip=\""+_translate("alt_note_task")+"\" class=\"ok-icon-calendar icon-font\"></span></a></div>"+
                                    "<div class=\"op hidden\"><a href=\"#\" class=\"tags\"><span data-i18ntooltip=\"alt_note_tags\" data-tooltip=\""+_translate("alt_note_tags")+"\" class=\"ok-icon-tages icon-font\"></span></a></div>"+
                                    "<div class=\"op hidden\"><a href=\"#\" class=\"info\"><span data-i18ntooltip=\"alt_note_detail\" data-tooltip=\""+_translate("alt_note_detail")+"\" class=\"ok-icon-info icon-font\"></span></a></div></div>"+
                                "<a href=\"#\" class=\"drag_trigger sort_trigger\"><span class=\"icon-font ok-icon-drag\"></span></a>"+deadline_html+top_menu_html+"</form>"+"<div class=\"strips\">"+default_tags_html+"</div>"+
                        "</div>";
                        console.log(str)
;            }
        }else{
            //如果不存在这个便签
            str = "<div class=\"note-con sortable"+is_task_class+""+exclass+" deleted\" style=\"display:none;\" data-position=\""+this.position+"\" data-id=\""+this.id+"\">"+
                        "<form  class=\"note\"><div class=\"field-con\">"+
                            "<div class=\"entities-con\"><div class=\"img-entity\"></div></div>"+
                            "<div class=\"note editable expand0-150 loaded\" contenteditable=\"false\" tabIndex=\"-1\"  spellcheck=false >"+this.content+"</div>"+
                            "<div class=\"linear-gradient\"></div></div>"+
                            "<div class=\"checkbox\"><span class=\"ok-icon-checked icon-font\"></span></div>"+
                            "<div class=\"bottom-menu\">"+
                                "<div class=\"op\"><a href=\"#\" class=\"more\"></a></div>"+
                                "<div class=\"op exit\"><a href=\"#\" class=\"share\"><span data-i18ntooltip=\"alt_note_share\" data-tooltip=\""+_translate("alt_note_share")+"\" class=\"ok-icon-share icon-font\"></span></a></div>"+
                                "<div class=\"op hidden\"><a href=\"#\" class=\"del\"><span data-i18ntooltip=\"alt_note_delete\" data-tooltip=\""+_translate("alt_note_delete")+"\" class=\"ok-icon-delete icon-font\"></span></a></div>"+
                                "<div class=\"op hidden\"><a href=\"#\" class=\"cal\"><span data-i18ntooltip=\"alt_note_task\" data-tooltip=\""+_translate("alt_note_task")+"\" class=\"ok-icon-calendar icon-font\"></span></a></div>"+
                                "<div class=\"op hidden\"><a href=\"#\" class=\"tags\"><span data-i18ntooltip=\"alt_note_tags\" data-tooltip=\""+_translate("alt_note_tags")+"\" class=\"ok-icon-tages icon-font\"></span></a></div>"+
                                "<div class=\"op hidden\"><a href=\"#\" class=\"info\"><span data-i18ntooltip=\"alt_note_detail\" data-tooltip=\""+_translate("alt_note_detail")+"\" class=\"ok-icon-info icon-font\"></span></a></div>"+
                            "</div>"+
                                "<a href=\"#\" class=\"drag_trigger\"><span class=\"icon-font ok-icon-drag\"></span></a></form>"+
                    "</div>";
        }
        
        this.html = str;
        return this;
    },

    get_notes_loc: function(callback){
    	callback = $.isFunction(callback) ? callback : null;
    	$.get(this.get_notes_loc_url,{type:"ajax",from:"web"},callback);
    },

    get_notes_by_ids: function(ids,callback){
    	if(!$.isArray(ids)){
    		return false;
    	}
    	callback = $.isFunction(callback) ? callback : null;
    	$.post(this.get_notes_by_ids_url,{type:"ajax",from:"web",ids:ids},callback);
    },

    get_info: function(callback){
        var saved_note = APP.get_note(this.id);
        
        var feedback = {
            create_time: saved_note.created,
            modified_time: saved_note.modified,
            source: saved_note.source,
            device: saved_note.device,
            lnglat: saved_note.location
        };
        $.isFunction(callback) ? callback(feedback) : null;
    	// callback = $.isFunction(callback) ? callback : null;
    	// if(this.is_valid("id",this.id)){
    	// 	$.post(this.get_info_url,{type:"ajax",from:"web",id:this.id},callback);
    	// }
    },

    get_archived_notes: function(exclude_ids,limit,callback){
    	callback = $.isFunction(callback) ? callback : null;
    	$.post(this.get_archived_url,{type:"ajax",from:"web",exclude_ids:exclude_ids,limit:limit},callback);
    },

    get_notes_by_time: function(time,exclude_ids,limit,callback){
    	callback = $.isFunction(callback) ? callback : null;
    	if(this.is_valid("time_or_date",time)){
    		$.post(this.get_history_url,{type:"ajax",from:"web",time:time,exclude_ids:exclude_ids,limit:limit},callback)
    	}
    },

    get_notes_by_device: function(device_name,exclude_ids,limit,callback){
    	callback = $.isFunction(callback) ? callback : null;
    	if(this.is_valid("device_name",device_name)){
    		$.post(this.get_notes_by_device_url,{type:"ajax",from:"web",device_name:device_name,exclude_ids:exclude_ids,limit:limit},callback)
    	}
    },

    get_num_in_tag: function(tag_id,callback){
    	callback = $.isFunction(callback) ? callback : null;
    	if(this.is_valid("tag_id",tag_id)){
    		$.post(this.get_num_in_tag_url,{type:"ajax",from:"web",tag_id:tag_id},callback);
    	}
    },

    check_cache_status: function(tag_id,last_refresh,num,callback){
    	callback = $.isFunction(callback) ? callback : null;
    	if(this.is_valid("tag_id",tag_id)){
    		$.get(this.check_cache_status_url,{type:"ajax",from:"web",tag_id:tag_id,last_refresh:last_refresh,num:num},callback);
    	}
    },

    save_last_opened: function(tag_id,pinit,callback){
    	callback = $.isFunction(callback) ? callback : null;
        pinit = pinit ? 1 : 0;
    	
        if(this.is_valid("tag_id",tag_id)){
           localStorage.last_opened_tid = tag_id;

    	   //临时固定标签
           if(pinit){
                localStorage.last_tmppined_tid = tag_id;
                if(callback) callback({status:"ok"});
           }
    	}
    },

    display_items: function(){
    	if(this.html){
    		$("#note #notes_con .inner-wrapper "+this.all_saved_con).append(this.html);
    	}
    	return this;
    },

    is_valid: function(field,value){
        switch(field){
            case "id": return $.isNumeric(value) && isFinite(value);break;
            case "tag_id": return $.isNumeric(value) && isFinite(value);break;
            case "task_id": return $.isNumeric(value) && isFinite(value);break;
            case "deadline": return (validate_date(value) || value == null);break;
            case "content": return $.type(value) == "string";break;
            case "search_str": return value.length < 100;break;
            case "coords": return value.match(/^\d[.0-9]+\|[.0-9]+\d$/);break;
            case "end_date": return (validate_date(value) || value==null);break;
            case "time_or_date": return validate_date(value);break;
            case "device_name": return $.type(value) == "string" && value.length < 50;break;
            case "tag": return $.type(value) == "string";break;
            case "order_str": return /^\d[\d\|]{0,}\d{0,}$/.test(value);break;
            default: return false;break;
        };
    },

    get_tag_ids: function(callback){
        var saved_note = APP.get_note(this.id);
        
        var tag_ids = saved_note.tags;
    	callback = $.isFunction(callback) ? callback({tag_ids:tag_ids}) : null;
    },

    loadmore: function(exclude_ids,limit,callback){
    	callback = $.isFunction(limit) ? limit : ($.isFunction(callback) ? callback : null);
    	limit = !isNaN(limit) && limit>0 ? limit : this.limit;
    	if($.isArray(exclude_ids)){
    		$.get(this.load_more_url,{type:"ajax",from:"web",exclude_ids:exclude_ids,limit:limit},callback);
    	}
    },

    get_active_dates: function(callback){
    	callback = $.isFunction(callback) ? callback : null;
    	$.get(this.get_dates_url,callback);
    },

    get_recent_devices: function(callback){
    	callback = $.isFunction(callback) ? callback : null;
    	$.get(this.get_recent_devices_url,callback);
    },

    get_recent_dates: function(howmany,callback){
    	if(isNaN(howmany)){
    		return false;
    	}
    	callback = $.isFunction(callback) ? callback : null;
    	$.get(this.get_recent_dates_url,{"howmany":howmany},callback);
    }
};

var Triangle = function(o){
	this.bWidth = o.bWidth || 10;
	this.bColor = o.bColor || "#ccc";
	this.bgColor = o.bgColor || "transparent";
	this.toward = o.toward || "right";//then left side(border left) will be painted
	this.shadow = o.shadow || true;
	this.shadowColor = o.shadowColor || false;
	this.con = o.con || null;
	this.posi = o.posi;
}

Triangle.prototype = {
	t_html: "<div class=\"wst\"></div>",
	ts_html: "<div class=\"wst_s\"></div>",
	bWidth: 10,
	shadow: true,
	bgColor: "transparent",
	bColor: "#ccc",
	posi: 50,
	draw: function(){
		var conClasses,towards,bWidth,bColor,bgColor,props;
		var that = this;
			if($(this.con).hasClass("ws_done")){
				return false;
			}

			conClasses = $(this.con).attr("class");
			if(console) console.log(this.con);
			var matchClasses = conClasses.match(/\s?ws\_([\w]+)\_([\S]+)/g);
			if(matchClasses && matchClasses.length > 0){
				for(var i=0,len=matchClasses.length;i<len;i++){
					var matchClass = matchClasses[i].match(/\s?ws\_([\w]+)\_([\S]+)/);
					if(matchClass && matchClass.length == 3){
						that[matchClass[1]] = matchClass[2];
					}
				}
			}
			
			if(that.shadow){
				$(this.con).append(this.t_html+this.ts_html);
			}else{
				$(this.con).append(this.t_html);
			}

			var top,left,
			conW = $(this.con).prop("offsetWidth") || $(this.con).width(),
			conH = $(this.con).prop("offsetHeight") || $(this.con).height(),
			conL = $(this.con).offset().left,
			conT = $(this.con).offset().top,
			conPos = $(this.con).css("position"),
			conShadow = $(this.con).css("box-shadow"),
			conBColor = $(this.con).css("border-color"),
			conBWidth = parseInt($(this.con).css("border-width")) || 1;
			
			conBColor = that.shadowColor || conBColor;

			if(that.towards){
				switch(that.towards){
					case "right": that.opp = "left";break;
					case "left": that.opp = "right";break;
					case "bottom": that.opp = "top";break;
					case "top": that.opp = "bottom";break;
					defautl: break;
				}
			}else{
				if(console) console.warn("It seems there is no direction of triangle on the element below: ");
				if(console) console.log($(this.con).get(0));
				return false;
			}

			var style = {
				position: "absolute",
				border: that.bWidth+"px solid "+that.bgColor
			};
			style["border-"+this.opp+"-color"] = that.bColor;
			
			$(this.con).find(".wst").css(style);
			$(this.con).find(".wst_s").css(style);

			var tHeight = $(this.con).find(".wst").prop("offsetHeight") || 2*that.bWidth;
			var tWidth = $(this.con).find(".wst_s").prop("offsetWidth") || 2*that.bWidth;

			if(that.towards == "top"){
				 top = "-"+(tHeight-conBWidth);
				 left = (that.posi*2/100) * (conW - tWidth)/2;
			}

			if(that.towards == "left"){
				 top = (that.posi*2/100) * (conH - tHeight)/2;
				 left = "-"+(tWidth-2*conBWidth);
			}

			if(that.towards == "right"){
				 top = (that.posi*2/100) * (conH - tHeight)/2;
				 left = (conW-conBWidth);
			}

			if(that.towards == "bottom"){
				 left = (that.posi*2/100) * (conW - tWidth)/2;
				 top = (conH-conBWidth);
			}

			if(conPos == "static"){
				if($(this.con).get(0).offsetParent){
					top = parseInt(conT) + parseInt(top);
					left = parseInt(conL) + parseInt(left);
				}
			}

			$(this.con).find(".wst").css({top:top+"px",left:left+"px"});

			if(that.towards == "bottom"){
				$(this.con).find(".wst_s").css({top:(parseInt(top)+conBWidth)+"px",left:parseInt(left)+"px"});
			}else if(that.towards == "top"){
				$(this.con).find(".wst_s").css({top:(parseInt(top)-conBWidth)+"px",left:parseInt(left)+"px"});
			}else if(that.towards == "left"){
				$(this.con).find(".wst_s").css({top:parseInt(top)+"px",left:(parseInt(left)-conBWidth)+"px"});
			}else if(that.towards == "right"){
				$(this.con).find(".wst_s").css({top:parseInt(top)+"px",left:(parseInt(left)+conBWidth)+"px"});
			}

			
			
			var sStyle = {
				zIndex: -999
			};
			sStyle["border-"+that.opp+"-color"] = conBColor || "#ccc";
			$(this.con).find(".wst_s").css(sStyle);
			$(this.con).addClass("ws_done");
	},

	loadTriangle: function(){
		var conClasses,towards,bWidth,bColor,bgColor,props;
		var that = this;
		$(".ws_triangle").filter(":visible").each(function(){
			if($(this).hasClass("ws_done")){
				return false;
			}

			conClasses = $(this).attr("class");
			var matchClasses = conClasses.match(/\s?ws\_([\w]+)\_([\S]+)/g);
			if(matchClasses && matchClasses.length > 0){
				for(var i=0,len=matchClasses.length;i<len;i++){
					var matchClass = matchClasses[i].match(/\s?ws\_([\w]+)\_([\S]+)/);
					if(matchClass && matchClass.length == 3){
						that[matchClass[1]] = matchClass[2];
					}
				}
			}
			
			if(that.shadow){
				$(this).append(that.t_html+that.ts_html);
			}else{
				$(this).append(this.t_html);
			}

			var top,left,
			conW = $(this).prop("offsetWidth") || $(this).width(),
			conH = $(this).prop("offsetHeight") || $(this).height(),
			conL = $(this).offset().left,
			conT = $(this).offset().top,
			conPos = $(this).css("position"),
			conShadow = $(this).css("box-shadow"),
			conBColor = $(this).css("border-color"),
			conBWidth = parseInt($(this).css("border-width")) || 1;
			conBColor = that.shadowColor || conBColor;
			if(that.towards){
				switch(that.towards){
					case "right": that.opp = "left";break;
					case "left": that.opp = "right";break;
					case "bottom": that.opp = "top";break;
					case "top": that.opp = "bottom";break;
					defautl: break;
				}
			}else{
				if(console) console.warn("It seems there is no direction of triangle on the element below: ");
				if(console) console.log(this);
				return false;
			}

			var style = {
				position: "absolute",
				border: that.bWidth+"px solid "+that.bgColor
			};
			style["border-"+that.opp+"-color"] = that.bColor;
			
			$(".wst",this).css(style);
			$(".wst_s",this).css(style);

			var tHeight = $(".wst",this).prop("offsetHeight") || 2*that.bWidth;
			var tWidth = $(".wst_s",this).prop("offsetWidth") || 2*that.bWidth;

			if(that.towards == "top"){
				 top = "-"+(tHeight-conBWidth);
				 left = (that.posi*2/100)*(conW - tWidth)/2;
			}

			if(that.towards == "left"){
				 top = (that.posi*2/100)*(conH - tHeight)/2;
				 left = "-"+(tWidth-2*conBWidth);
			}

			if(that.towards == "right"){
				 top = (that.posi*2/100)*(conH - tHeight)/2;
				 left = (conW-conBWidth);
			}

			if(that.towards == "bottom"){
				 left = (that.posi*2/100)*(conW - tWidth)/2;
				 top = (conH-conBWidth);
			}

			if(conPos == "static"){
				if(this.offsetParent){
					top = parseInt(conT) + parseInt(top);
					left = parseInt(conL) + parseInt(left);
				}
			}

			$(".wst",this).css({top:top+"px",left:left+"px"});

			if(that.towards == "bottom"){
				$(".wst_s",this).css({top:(parseInt(top)+conBWidth)+"px",left:parseInt(left)+"px"});
			}else if(that.towards == "top"){
				$(".wst_s",this).css({top:(parseInt(top)-conBWidth)+"px",left:parseInt(left)+"px"});
			}else if(that.towards == "left"){
				$(".wst_s",this).css({top:parseInt(top)+"px",left:(parseInt(left)-conBWidth)+"px"});
			}else if(that.towards == "right"){
				$(".wst_s",this).css({top:parseInt(top)+"px",left:(parseInt(left)+conBWidth)+"px"});
			}
			
			var sStyle = {
				zIndex: -999
			};

			sStyle["border-"+that.opp+"-color"] = conBColor || "#ccc";
			$(".wst_s",this).css(sStyle);
			$(this).addClass("ws_done");
		});
	}
};

//在一个div上均分几个元素
jQuery.fn.monoplace = function(elemsclass){
	var $ = jQuery;
	if(this.length == 0 || $(elemsclass,this).length == 0){
		return false;
	}

	var _this = this,
		$elems = $(elemsclass,_this).css("display","none");
	$(document).ready(relocate);

	//$(window).on("resize",relocate);

	function relocate(){
		var conWidth = _this.width(),
		conHeight = _this.height(),
		conPos = _this.css("position"),
		conLeft = 0,
		$elems = $(elemsclass,_this),
		elemWidth = 0,
		elemHeights = new Array(),
		elemHeight = 0,
		elemLen = $elems.length,
		elem = null,

		partialWidth = conWidth/(elemLen+1);
		if(conPos == "static"){
			conLeft = _this.prop("offsetLeft");
		}

		for(var i=0; i<elemLen; i++){
			elem = $elems.get(i);
			elemWidth = $(elem).width();
			elemHeight = $(elem).height();
			elem.style.position = "absolute";
			elem.style.left = ((i+1) * partialWidth - elemWidth/2 + conLeft) + "px";
			$(elem).data("pos-left",elem.style.left);
			elemHeights.push(elemHeight);
		}
		var maxElemHeight = elemHeights.sort(function(a,b){if(a < b){return false; }return true;}).pop();
		if(_this.height() < maxElemHeight){
			_this.css("min-height",maxElemHeight+"px");
		}
		$elems.fadeIn();
	}
};

jQuery.fn.monoplace_beta = function(elemsclass,padding){
	var $ = jQuery;
	var padding = padding != undefined ? parseInt(padding) : 5;

	if(this.length ==0 || $(elemsclass,this).length == 0){
		return false;
	}

	var _this = this;
		$elems = $(elemsclass,_this).css({"display":"none","visibility":"hidden"});

		$(document).ready(relocate);

	function relocate(){
	var conWidth = _this.width(),
		conHeight = _this.height(),
		conPos = _this.css("position"),
		conLeft = 0,
		$elems = $(elemsclass,_this),
		elemWidth = 0,
		elemHeights = new Array(),
		elemHeight = 0,
		elemLen = $elems.length,
		elem = null,
		firstWidth = $elems.first().width(),
		lastWidth = $elems.last().width(),
		firstBar = padding + firstWidth/2,
		lastBar = padding + lastWidth/2,
		margin = (conWidth - lastBar - firstBar)/(elemLen - 1);
		
		if(conPos == "static"){
			conLeft = _this.prop("offsetLeft");
		}

		for(var i=0; i<elemLen; i++){
			elem = $elems.get(i);
			elemWidth = $(elem).width();
			elemHeight = $(elem).height();
			elem.style.position = "absolute";
			elem.style.left = (((firstBar + i*margin + conLeft - elemWidth/2)/conWidth)*100)+"%";
			//elem.style.left = (firstBar + i*margin + conLeft - elemWidth/2) + "px";
			$(elem).data("pos-left",elem.style.left);
			elemHeights.push(elemHeight);
		}
		var maxElemHeight = elemHeights.sort(function(a,b){if(a < b){return -1; }return 2;}).pop();
		if(_this.height() < maxElemHeight){
			_this.css("min-height",maxElemHeight+"px");
		}
		$elems.css("visibility","visible").fadeIn();
	}
};

var mapObj;
/*
思路：
	得到所有便签记录的经纬度 通过 geocoder 将经纬度转换为地理位置，得到相同城市或直辖市的便签，得到数量，得到相同区的便签，得到数量；
	当用户点击城市时，全部展示，以区为类别分组

	若是只有IP地址，暂无好的解决方法
*/

//初始化地图对象
function init_map(mapconid){
	mapconid = !!mapconid ? mapconid : "map_con";

	if(mapObj == undefined){
		mapObj = new AMap.Map(mapconid,{
	    	//dragEnable: false,
	    	zoomEnable: false,
	    	level: 5,
	    	scrollWheel: false,
	    	center: new AMap.LngLat(143.11615, 36.350527),
	    	touchZoom: false,
	    	resizeEnable: true
	    });
	}
}

//加载地图
function loadSticks(){
	init_map();
	//得到所有当前用户便签的添加时间以及添加经纬度
	//返回的结果应该为如下
	//[{id:23,time:2014-1-1 09:23:20,lnglat:112.23433|23.23343},
	//{id:32,time:2014-1-1 09:23:20,lnglat:112.23433|23.23343},
	//{id:24,time:2014-1-1 09:23:20,lnglat:112.23433|23.23343}]
	//取出id是为了方便点击地理标记后取出相应的便签
	
	Note.prototype.get_notes_loc(function(data){
		var feedback = get_json_feedback(data),
			tmp_lng,tmp_lat,city_info,
			note = null,
			first_note = null,
			marker = null,
			detailed_notes = new Array(),
			all_cities = {};
		
		//循环给每个便签添加上位置属性 city:(若高德返回的地理信息无city如直辖市北京则使用province) 具体信息 geo_detail:(formattedAddress)
		
		for(var i=0; i<feedback.length; i++){
			note = feedback[i];
			if(i == feedback.length-1){
				$("#map_con").addClass("loop-done");
			}

			if(!!note.lnglat && note.lnglat != ","){
				geocoder(note,all_cities); //geocoder ends
			}
		}//end outer for loop
	});
}

function get_position(callback){
    //先看本地有在一个钟头之前存储有地理位置，如果有的话，则直接取，否则再次更新地理位置
    /*如果用户接受地理定位，则询问地理位置*/
    if(navigator.geolocation){
        var coords = null;

        if(localStorage.geoInfo){
            try{
                var geoInfo = JSON.parse(localStorage.geoInfo);

                if( Date.now() - geoInfo.recorded < 1000 * 60 * 30 && geoInfo.coords && geoInfo.coords.lng){
                    coords = geoInfo.coords;
                    if($.isFunction(callback)) callback(coords);
                }
            }catch(e){
                Tracker.sendEvent("JSON Parse Error","parse position");
            }
        }


        if(!coords){
            navigator.geolocation.getCurrentPosition(function(position){
                var lng = position.coords.longitude,
                    lat = position.coords.latitude;

                    coords = {lng:lng,lat:lat};
                var geoInfo = {
                        recorded: Date.now(),
                        coords: coords
                    };

                    localStorage.geoInfo = JSON.stringify(geoInfo);

                    //将用户地理位置保存至本地存储或添加dom data
                    //用于以后保存书签时添加地理信息
                    if($.isFunction(callback)) callback({lng:lng,lat:lat});
            },function(PosError){
                //PositionError {
                //   message: "User denied Geolocation",
                //   code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3}
                switch(PosError.code){
                    //根据状态码判定操作
                    case 1: 
                        // showMessage({type:"warning",msg:"地理定位处于启用状态，如需关闭地理定位可以点击<a href=\"#\" class=\"off-geo\">此处</a>"});
                        Tracker.sendEvent("Geo","拒绝定位");
                        break; //用户拒绝定位
                    case 2:
                        // showMessage({type:"warning",msg:"无法获取您的位置信息"}); 
                        Tracker.sendEvent("Geo","不支持定位");
                        break; //硬件不支持或处于无网络连接状态
                    case 3: 
                        // showMessage({type:"warning",msg:"网络连接超时"});
                        Tracker.sendEvent("Geo","请求地理位置超时");
                        break; //网络连接慢，获取地理位置超时
                    default: break;
                }
            });
        }
    }
}

function renderReverse(response){
	var loc = "定位失败";
	if(console) console.log(response);
	if(response.status == "0"){
		var addressComponent = response.result.addressComponent;
		tmp_loc = addressComponent.province + addressComponent.city + addressComponent.district;
		loc = !!tmp_loc ? tmp_loc : loc;
	}
	$(".geo-web span.loc").text(loc);
	$("#note_ops .info .location .content").text(loc).closest(".note-con").data("loc",loc);
}

//得到具体地理位置信息
function geocoder(note,all_cities){
	var coder;
	var lng = note.lnglat.split("|")[0];
	var lat = note.lnglat.split("|")[1];
	var first_note = null;
	var city_info = null;
	//加载地理编码插件  
	mapObj.plugin(["AMap.Geocoder"], function(){ //加载地理编码插件  
	    coder = new AMap.Geocoder({  
	        radius: 1000, //以已知坐标为中心点，radius为半径，返回范围内兴趣点和道路信息
	    });
	    
	    //返回地理编码结果  
	    //AMap.event.addListener(coder, "complete", geocoder_CallBack);
	    AMap.event.addListener(coder, "complete", function(data){
	    	if(data.info == "OK"){
				var addressComponent = data.regeocode.addressComponent;
				var city = (addressComponent.city != "") ? addressComponent.city : addressComponent.province;
				note.city = city;
				note.geo_detail = data.regeocode.formattedAddress;

				if(!!all_cities[city]){
					//将已存在的这个city的num加1
					all_cities[city].num++;
					all_cities[city].ids.push(note.id);
				}else{
					first_note = {lng:lng,lat:lat,city:city,num:1,ids:[note.id]};
					all_cities[city] = first_note;
					city_info = {lng:lng,lat:lat,city:city,num:1,ids:[note.id]};
					
					//为该城市创建一个地理标记
					var marker = new AMap.Marker({
						map: mapObj,
						position: new AMap.LngLat(city_info.lng,city_info.lat),
						
						//设置地理编辑点提示内容，可能是便签的标题
						content: "<div class=\"note\"><img class=\"icon\" src=\"http://webapi.amap.com/images/1.png\" /><a class=\"num\" href=\"#\">"+city_info.num+"</a></div>"
					});

					/* -------- 为地理标记添加事件监听函数 --------- */
			    	AMap.event.addListener(marker,"mouseover",function(mapEvent){
				     	//浏览器原生事件对象
				    	var event = mapEvent.originalEvent || event || window.event;
				    });

				    AMap.event.addListener(marker,"click",function(mapEvent){
				    	//geocoder(mapEvent.lnglat.lng,mapEvent.lnglat.lat);
				    	//浏览器原生事件对象
				    	var event = mapEvent.originalEvent || event || window.event;
						EventUtil.preventDefault(event);

						city_info = all_cities[city];
						
						if(!!city_info.ids){
							get_notes_by_ids(city_info.ids);
						}
				    });
				}
			}

			try{
				mapObj.setFitView();
			}catch(e){

			}

			if($("#map_con").hasClass("loop-done")){
				var cities_html = "",city_obj,ids;
				var i=0;
				for(var city_name in all_cities){
					i++;
					city_obj = all_cities[city_name];
					ids_str = city_obj.ids.join(",");

					cities_html += "<a href=\"#\" class=\"loc city-"+i+"\" title=\""+city_obj.num+"条便签\" data-ids=\""+ids_str+"\">"+city_obj.city+"</a>";
					
					$(".locs .recent-locs .city-"+i).data("ids",ids_str);

					$(".locs .recent-locs").off("click",".city-"+i);
					$(".locs .recent-locs").on("click",".city-"+i,function(event){
						event = EventUtil.getEvent(event);
						EventUtil.preventDefault(event);
						
						var ids_data = $(this).data("ids");
						
						if(!!ids_data){
							var ids_arr = ids_data.split(",");
							get_notes_by_ids(ids_arr);
						}
					});
				}

				var recent_html = $(".locs .recent-locs").html();
				if(recent_html != cities_html){
					$(".locs .recent-locs").html(cities_html);
				}
			}
			//console.log(all_cities); //Object {酒泉市: Object 31, 北京市: Object 16}
	    });

	    //逆地理编码  
	    coder.getAddress(new AMap.LngLat(lng, lat));

	    ///地理编码  
        //coder.getLocation("北京市海淀区苏州街");
	});
}

function get_notes_by_ids(ids){
	if(!!!ids || !$.isArray(ids)){
		return false;
	}
	
	Note.prototype.get_notes_by_ids(ids,function(odata){
		var feedback = get_json_feedback(odata),notes,note,noteobj;
		if(feedback.notes && feedback.notes.length > 0){
            notes = feedback.notes;
            var note_html = "";
            for(var i=0,len=notes.length; i<len; i++){
                noteobj = notes[i];
           
                note = new Note(noteobj);
                note.construct_item();
                note_html += note.html;
            }
            $("#search_results .by-loc").html("").append(note_html);

            $("#search_results .by-loc .note-con").each(function(){
                var $note = $(this).find(content_area); //".note.editable" => content_area
                if($note.length > 0){
                    $note.get(0).style.height = 0;
                    $note.get(0).style.height = Math.min(150,$note.get(0).scrollHeight) + "px";
                }
            });
            highlight_colored_tags();
        }
	});
}

function getSelectedHTML() {                                        
  if(window.getSelection){
      var userSelection = window.getSelection();
        if (userSelection.isCollapsed) 
            return '';
        else {
            var range = userSelection.getRangeAt(0);
            var clonedSelection = range.cloneContents();
            var div = document.createElement('div');
            div.appendChild(clonedSelection);
            
            //将相对链接转换为绝对链接
            var hrefs = div.querySelectorAll('[href]');
            for (var i=0, len=hrefs.length; i<len; i++) 
                hrefs[i].href = hrefs[i].href;
            var srcs = div.querySelectorAll('[src]');
            for (var i=0, len=srcs.length; i<len; i++) 
                srcs[i].src = srcs[i].src;
            var content = div.innerHTML || window.getSelection().toString();
            
            return content;
        }
    }else if(document.selection){
        var userSelection = document.selection.createRange();
        return userSelection.htmlText;
    }else{
        return "";
    }
}

//不太准确
function ip2geo(ip) {   
    //加载城市查询插件  
    mapObj.plugin(["AMap.CitySearch"], function() {  
        //实例化城市查询类  
        var citysearch = new AMap.CitySearch();  
        //自动获取用户IP，返回当前城市  
        citysearch.getLocalCity();  
        //citysearch.getCityByIp(ip);
        AMap.event.addListener(citysearch, "complete", function(result){  
             if(console) console.log(result);
        });
        AMap.event.addListener(citysearch, "error", function(result){alert(result.info);});  
    });
}

//对于不支持JSON.stringfy的浏览器载入json2.js
(function(){
    if(!!!JSON.stringify){
        var d = document,
            s = d.createElement("script");
            s.src = location.host+"/scripts/json2.js";
            s.type = "text/javascript";
            d.getElementsByTagName("head")[0].appendChild(s);
    }
})();

// var Latest_notes = (function(){
// 	//如果浏览器本地存储特性不可用，则返回错误
// 	if(!localStorage){
// 		return false;
// 	}

// 	var lls = localStorage;
// 	var lns = "latest_notes";

// 	return {
// 		add: function(id,obj){
// 			var all = lls.getAll();
// 			if(!obj.created){
// 				obj.created = get_current_time();
// 			}

// 			all[id] = obj;
// 			this.setAll(all);
// 		},

// 		remove: function(id){
// 			var all = lls.getAll();
// 				delete all[id];
// 				this.setAll(all);
// 		},

// 		update: function(id,obj){
// 			var all = lls.getAll();
// 			if(!obj.modified){
// 				obj.modified = get_current_time();
// 			}

// 			all[id] = obj;
// 			this.setAll(all);
// 		},

// 		display: function(num){
			
// 		},

// 		get: function(id){
// 			return !!this.getAll()[id] ? this.getAll()[id] : false;
// 		},

// 		getAll: function(type){
// 			type = !!type ? type : "object";
// 			if(type == "object"){
// 				if(this.exists()){
// 					return JSON.parse(lls.getItem(lns));
// 				}else{
// 					return {};
// 				}
// 			}

// 			if(type == "string"){
// 				return lls.getItem(lns);
// 			}
// 		},

// 		setAll: function(objs){
// 			if(!!objs){
// 				lls.setItem(lns,JSON.stringify(objs));
// 			}
// 		},

// 		exists: function(){
// 			return !!lls.getItem(lns) && lls.getItem(lns) != "{}";
// 		},

// 		local_stored: function(){
// 			return !!lls.local_stored;
// 		},

// 		set_flag: function(flag){
// 			return lls.setItem("local_stored",flag);
// 		},

// 		set_remote_flag: function(flag){
// 			$.post("/user/config",{local_stored_flag:!!flag});
// 		}
// 	};
// })();


(function($){
    $.fn.load_img_onscroll = function(option,onload_callback,onerror_callback){
        var defaultOption = {
            offScreen: 0
        };

        option = $.extend(defaultOption,option || {});

        var scroll_con = (option && option.container) ? option.container : window;
        var _this = this;

        var load_img = function(){
            var that = this;
            var con_el = this;

            if(option.parentSelector){
                con_el = $(this).closest(option.parentSelector).get(0);
            }

            //如果scrollTop大于图片的top-(x)px则加载图片
            if(elementInViewport(con_el,option.offScreen)){

                if(option.timeout){
                    var load_timeout = setTimeout(function(){
                        //如果过了用户设定的时间，仍然在加载，则使用替代图片
                        if($(that).hasClass(option.loading_class)){
                            that.src = option.fallback_src;
                            that.onload = function(){$(this).removeClass("unloaded");}
                        }
                    },option.timeout); 

                    //加载限定时间，超过10s则取消加载用其他图片代替
                    if(onload_callback && $.isFunction(onload_callback)){
                        that.onload = function(){
                            onload_callback.call(this);
                            clearTimeout(load_timeout);
                        };
                    }
                }else{
                    if(onload_callback && $.isFunction(onload_callback)) this.onload = onload_callback;
                    if(onerror_callback && $.isFunction(onerror_callback)) this.onerror = this.onabort = onerror_callback;
                }

                is_image_url($(this).data("src"));
                

                if($(this).data("src")){
                    this.src = $(this).data("src");
                }
            }
        };

        _this.each(load_img);

        $(scroll_con).on("scroll.load_image",function(event){
            if($(_this.selector).length > 0) $(_this.selector).each(load_img);
        });
    }
})(jQuery);

function elementInViewport(el,extra) {
    if(!el) return false;
    extra = extra || 0;
    if(el.getBoundingClientRect){
        var rect = el.getBoundingClientRect();
    }else{
        var rect = $(el).offset();
    }
    var screen_height = (typeof idl != "undefined" && idl.screen_height) ? idl.screen_height : (window.innerHeight || document.documentElement.clientHeight);

    return (
           rect.top    >= 0
        && rect.left   >= 0
        && rect.top <= screen_height + extra
        );
}

function getBrowserName(){
    var browser = null;

    if(typeof window.safari != "undefined"){
        return "safari";
    }if(typeof window.sogou != "undefined" || (window.external && window.external.Sogou404)){
        return "sogou";
    }if(typeof InstallTrigger != "undefined" || typeof window.scrollMaxX != "undefined"){
        return "firefox";
    }if(navigator.userAgent.toLowerCase().indexOf("opera") >= 0){
        return "opera";
    }else if(browser == "chrome" && window.externalfa){
        var keys = Object.keys(window.external);
        if(keys.length > 0){
            for(var i=0,len=keys.length; i<len; i++){
                if(keys[i].toLowerCase().indexOf("liebao") >= 0){
                    return browser = "liebao";
                }
            }
        }
    }else if(is360se()){
        return "360se";
    }

    //通过特性检测得到浏览器
    if(typeof window.chrome != "undefined" || navigator.userAgent.toLowerCase().indexOf("chrome") >= 0){
        browser = "chrome";
    }

    //360极速浏览器
    if(browser == "chrome" && window.external && Object.keys(window.external).length > 2){
        browser = "360ee";
    }

    return browser;
}

function is360se() {
    if( navigator.userAgent.toLowerCase().indexOf('chrome') > -1 ) {
        var desc = navigator.mimeTypes['application/x-shockwave-flash'].description.toLowerCase();
        if (desc.indexOf('adobe') > -1) {
            return true;
        }
    }
    return false;
}


function checkBrowser(){
    var browsers_info = {
        "safari": {
            name: _translate("safari"),
            store_url: "http://m.okay.do/download/extension/safari",
            package_url: "http://m.okay.do/download/extension/safari"
        },

        "sogou": {
            name: _translate("sogou"),
            store_url: "http://ie.sogou.com/app/app_4272.html",
            package_url: "http://m.okay.do/download/extension/sogou"
        },

        "firefox": {
            name: _translate("firefox"),
            store_url: "https://addons.mozilla.org/zh-CN/firefox/addon/okmemo/",
            package_url: "http://m.okay.do/download/extension/firefox"
        },

        "opera": {
            name: _translate("opera"),
            store_url: "",
            package_url: ""
        },

        "liebao": {
            name: _translate("liebao"),
            store_url: "http://store.liebao.cn/search.html?keyword=ok%E8%AE%B0#!ipjdccfclikkjmdbbphjammfflaecghd",
            package_url: "http://m.okay.do/download/extension/liebao"
        },

        "360se": {
            name: _translate("360se"),
            store_url: "https://ext.se.360.cn/webstore/detail/ipjdccfclikkjmdbbphjammfflaecghd",
            package_url: "http://m.okay.do/download/extension/360safe"
        },

        "360ee": {
            name: _translate("360ee"),
            store_url: "https://ext.chrome.360.cn/webstore/detail/ipjdccfclikkjmdbbphjammfflaecghd",
            package_url: "http://m.okay.do/download/extension/360jisu"
        },

        "chrome": {
            name: _translate("chrome"),
            store_url: "https://chrome.google.com/webstore/detail/ok%E8%AE%B0okmemo/nejabgnmljggkeofllackkopgjgdcamp",
            package_url: "http://m.okay.do/download/extension/chrome"
        }
    };
    var browser = getBrowserName();
    var browserInfo =browsers_info[browser];
    $("#store").attr("href",browserInfo.store_url);
    $("#store").text(browserInfo.name);
}