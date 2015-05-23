idl = idl || {};

jQuery(function($){
    idl.LM = idl.LM ? idl.LM : new LocalManager();

    //通知插件已经ready
    if(window.postMessage){
        window.top.postMessage({command:"app_is_ready"},"*");
    }

    var note_ops = document.getElementById("note_ops"),
        all_saved_con = ".all",
        content_area = ".note.editable",
        cache_num = 50;

    //添加提示
    $(".icon-font").aloha();

    if(location.hash){
        switch(location.hash.substr(1)){
            case "login":
                $("body").addClass("login-popup");
                break;
        };
    }
    

    $(window).on("load",function(){
        //如果没有时区的cookie则检测时区然后设置时区的cookie
        if(!Cookies.get("tz")){
            getTimezone();
        }
        
        //加载语言
        User.prototype.load_lang("homepage",function(lang){
            idl._script_lang = lang;

            // internationalization
            (function(){
                // 提示文字
                var $tooltips = $("*[data-i18ntooltip]");

                $tooltips.each(function(){
                    $(this).attr("data-tooltip",_translate($(this).data("i18ntooltip")) );
                });
            })();

            checkBrowser();
        });

        //本地通知中心
        NotificationCenter.init();
    });

    if($("html").hasClass("ie6") || $("html").hasClass("ie7")) $("p.chromeframe").animate({height:"40",opacity:1},"slow");
    if(window.localStorage){
        if(localStorage._font_size) $("body").addClass(localStorage._font_size);

        if(!localStorage._note_read){
            $(".massage .number").text(1);

            $(".massage-btn").one("click",function(event){
                localStorage._note_read = 1;
                $(".massage .number").text(0);
            });
        }
    }

    //搜索栏的位置及宽度
    var stickyTop = $('#search_area').offset().top;
    var stickyWidth = $('#search_area').width();

    //先将html的overflow设为hidden,然后再在js里面设为auto是为了处理chrome的自定义scrollbar无法显示的问题
    //只有动态改变overflow值才能在html节点上生效
    $("html").css("overflow","auto");

    //给上最后刷新时间，以便之后作缓存是否有效的判断
    $("#search_results .by-tag").data("last_refresh",get_current_time());

    (function(){
        //支持触摸设备，需要扩大可点击范围
        if( ("ontouchstart" in window || window.navigator.pointerEnabled || window.navigator.msPointerEnabled) && window._ENV.mobile) $("body").addClass("touch-device");

        if(window.top != self) $("body,html").addClass("in-frame");
        else $("body,html").addClass("top-win");

        if(document.createElement("a").download != "") $("body").addClass("no-attr-dl");
        else $("body").addClass("attr-dl");

        if(window._ENV){
            var os_class = window._ENV.os.replace(/[\s|\_]/g,"-").toLowerCase();
            var browser_class = window._ENV.browser.replace(/[\s|\_]/g,"-").toLowerCase();
            $("body").addClass(os_class+" "+browser_class);
        }

        // 各种浏览器兼容
        var hidden, state, visibilityChange; 
        if (typeof document.hidden !== "undefined") {
            hidden = "hidden";
            visibilityChange = "visibilitychange";
            state = "visibilityState";
        } else if (typeof document.mozHidden !== "undefined") {
            hidden = "mozHidden";
            visibilityChange = "mozvisibilitychange";
            state = "mozVisibilityState";
        } else if (typeof document.msHidden !== "undefined") {
            hidden = "msHidden";
            visibilityChange = "msvisibilitychange";
            state = "msVisibilityState";
        } else if (typeof document.webkitHidden !== "undefined") {
            hidden = "webkitHidden";
            visibilityChange = "webkitvisibilitychange";
            state = "webkitVisibilityState";
        } else {
            //标志用户的活动状态，若在10秒以内没发生任何动作，则可以认为页面为空闲状态，进而决定进行特定的操作
            $("body").on(moveEvent + " keyup click scroll"+downEvent,function(event){
                $("body").addClass("user-active");
                if(idl.active_record) clearTimeout(idl.active_record);
                
                idl.active_record = setTimeout(function(){
                    $("body").removeClass("user-active");
                },10000);
            });
            return false;
        }

        if(document[hidden]) $("body").addClass("doc_hidden");
        else $("body").addClass("doc_visible");

        // 添加监听器
        $(document).on(visibilityChange,function(){
            if(document[hidden]){
                 $("body").addClass("doc_hidden").removeClass("doc_visible");

                 //如果新便签中有内容，则帮其保存
                 if($("#blank_sheet .note-con").hasClass("modified") || $.trim($("#blank_sheet .note-con .note.editable").html()) != ""){
                    Tracker.sendEvent('Create New Note','visibilitychange');
                    $("#blank_sheet form").submit();
                 }
            }else{
                 //打开新的tab，将APP的所有数据刷新一遍
                 //APP.refresh();
                 $("body").addClass("doc_visible").removeClass("doc_hidden");

                 //检测是否新便签中有内容，若有则检测是否为刚才保存了的，若是则清除
                 if(localStorage && localStorage.newly_saved){
                    if($("#blank_sheet .note-con").data("stamp") == localStorage.newly_saved){
                        $("#blank_sheet .note-con").removeClass("modified").find(".note.editable").data("value","").html("");
                    }
                }

                //如果用户已经登录则在提醒用户之后刷新页面
                if(!$("body").hasClass("visitor")){
                    window.location.reload();
                }
            }
        });

        refreshShareIcons();
    })();

    //监听客户端存储变化
    if (window.attachEvent){
       window.attachEvent('onstorage', function(event){
            idl.LM.onStorageUpdate.call(idl.LM,event);
       });
    } else {
        window.addEventListener('storage', function(event){
            idl.LM.onStorageUpdate.call(idl.LM,event);
        }, false);
    }

    //-----------------
    //用户登录部分
    //关闭登录框
    $("#login").on("click "+downEvent,".close-btn",function(event){
        event.preventDefault();
        Tracker.sendEvent('Close Login Form','click');
        APP.toggle_authwin();
    });

    //-----------------
    //安装浏览器扩展
    $("#install_area a").on("click",function(event){
        event.preventDefault();
        Tracker.sendEvent('Install Extension Button','click');
        if($("#install_area").hasClass("installing") || $("#install_area").hasClass("installed")) return false;

        $("#install_area").addClass("installing");
        APP.install_ext(function(e){
            $("#install_area").addClass("installed").removeClass("installing").removeClass("active");
        },function(e){
            $("#install_area").removeClass("installing");
            console.log(e);
        });
    });


    //-------------------
    //得到插件发过来的通知
    $(window).on("message",function(event){
        event = event.originalEvent;
        var data = event.data;

        if(data){
            switch(data.command){
                case "save_note":
                    Tracker.sendEvent('Save New Note','From extension');
                    if(!!!data.content) return false;
                    var note = new Note({title:data.title,content:data.content,source:data.source});
                    note.readslater = data.readslater;
                    note.app_hidden = data.app_hidden;

                    note.save(function(feedback){
                        console.log(feedback);
                        if(feedback.status == "ok"){
                            note.id = feedback.id;
                            //保存成功，接着展示
                            APP.display_note(note);
                        }
                    });
                    break;
                default: break;
            }
        }
    });
    //-------------------插件通知部分结束

    //当用户在页面上按下Ctrl/Cmd + S时，保存所有未保存得便签，并给出友好的提示
    $(document).on("keydown",function(event){
        event = EventUtil.getEvent(event);
        
        //快捷键 Ctrl/Cmd + S
        if(event.keyCode && event.keyCode == 83 && (event.metaKey || event.ctrlKey)){
            Tracker.sendEvent('Save Note','keyboard shortcut on document');
            EventUtil.preventDefault(event);
            if($(".note-con.editing").length > 0){
                return false;
            }

            $(".note-con.modified").each(function(){
                $("form",this).submit();
            });
            check_local_saved();
        }
    });

    function divide_task_area(){
        $("h1.today-area").length == 0 ? $("#search_results.results-of-tasks .note-con.task.today").first().before("<h1 class=\"today-area\">"+(_translate("title_today") || "今天")+"<hr></h1>") : "";
        $("h1.later-area").length == 0 ? $("#search_results.results-of-tasks .note-con.task.today").last().after("<h1 class=\"later-area\">"+(_translate("title_later") || "以后")+"<hr></h1>") : "";
    }

    /* 初始化(完成添加事件监听器，初始化时间轴等任务) */
	function initialize(){
            //从本地添加数据
            APP.initialize();

            //今日任务分出
            divide_task_area();

            //便签内容拖拽时只允许copy
            $("body").on("dragstart",".note-con.editing " + content_area,function(event){
                event = EventUtil.getEvent(event);
                event.originalEvent.dataTransfer.effectAllowed = "copymove";
            });

            $("body").on("dragleave",".note-con.editing " + content_area,function(event){
                read_mode(this);
            });

            //若有内容被拖入新便签则使其成为可编辑状态
            $("body").on("dragenter","#blank_sheet "+content_area,function(event){
                $(this).attr("contenteditable","true");
                event = EventUtil.getEvent(event);
                event.originalEvent.dataTransfer.dropEffect = "copy";
            });

            //若有内容被拖入被固定的便签则使其成为可编辑状态
            $("body").on("dragenter",".fixed.maximized "+content_area,function(event){
                write_mode(this);
                event = EventUtil.getEvent(event);
                event.originalEvent.dataTransfer.dropEffect = "copy";
                event.originalEvent.dataTransfer.effectAllowed = "copy";
            });

            $("body").on("drop",".fixed.maximized "+content_area,function(event){
                $(this).closest('.note-con').addClass("editing modified");
            });

            //若被拖出，被固定的便签则使其成为可读
            $("body").on("dragleave",".fixed.maximized "+content_area,function(event){
                read_mode(this);
            });

            $("body").on("drop","#blank_sheet "+content_area,function(event){
                event = EventUtil.getEvent(event);
                var dt = event.originalEvent.dataTransfer;
                var content = "";
                var that = this;

                if($.inArray("Files",dt.types) >= 0){
                    if(console) console.log(dt.files);
                    var file = null;
                    
                    for(var i=0; i<dt.files.length; i++){
                        file = dt.files[i];
                        if(file.type.match(/text.*/) && window.FileReader){
                            var reader = new FileReader();

                            reader.onload = function(event){
                                if(console) console.log(event.target.result);
                                if(event.target.result.length < 5000)
                                    that.innerHTML += event.target.result;
                            };
                            reader.readAsText(file);
                        }else if(file.type.match(/image.*/) && window.FileReader){
                            var reader = new FileReader();
                            Tracker.sendEvent('Input Method','drag image');
                            reader.onload = function(event){
                                if(console) console.log(event.target.result);
                            };
                            reader.readAsDataURL(file);
                        }
                    }
                }

                if($.inArray("text/html",dt.types)>=0 || $.inArray("text/uri-list")>=0){
                    //放入的数据为html格式
                    content = dt.getData("text/html");
                    if(content.toLowerCase().indexOf("schemas-microsoft-com:office:office") >= 0 || content.toLowerCase().indexOf("mso-") >= 0){
                        Tracker.sendEvent('Input Method','drag from excel or word');
                        //拖入的内容来自word或excel等软件
                        content = dt.getData("text/plain");
                    }

                    if($.trim(content) == ""){
                        content = dt.getData("text/uri-list");
                    }
                }else{
                    content = dt.getData("text/plain");
                }

                if(!content){content = dt.getData("text/plain");}

                if($.trim(content) != ""){
                    this.innerHTML = content;
                    $(this).closest(".note-con").addClass("modified");
                }

                EventUtil.preventDefault(event);
            });

            $("body").on("paste","#blank_sheet "+content_area,function(event){
                event = EventUtil.getEvent(event);
                var dt = event.originalEvent.clipboardData;
                if(console) console.log(dt.types);

                Tracker.sendEvent('Input Method','paste');
                if( $.inArray("text/plain",dt.types) >= 0 || $.inArray("text/html",dt.types)>=0 || $.inArray("text/uri-list")>=0){
                    //放入的数据为html格式
                    content = dt.getData("text/html");
                    
                    if(content.toLowerCase().indexOf("schemas-microsoft-com:office:office") >= 0 || content.toLowerCase().indexOf("mso-") >= 0){
                        Tracker.sendEvent('Input Method','paste from excel or word');

                        //拖入的内容来自word或excel等软件
                        content = dt.getData("text/plain");
                    }

                    // this.innerHTML = content;
                    pasteHtmlAtCaret(content);
                    $(this).data("method","paste");
                    $(this).closest(".note-con").addClass("modified");
                
                    EventUtil.preventDefault(event);
                }
            });

            //调整容器高度
            // $("#note .note-con "+content_area).each(function(){
            //     $(this).data("value",this.innerHTML);

            //     //将图片和文字全部转化为链接 （分三种情况：1.加载时，2.加载更多时，3.blur时，4.保存时，也就是离开编辑模式便成为富文本）
            //     var content = decode_content(this.innerHTML);
            //     $(this).html(content);
            //     this.style.height = 0;
            //     this.style.height = (Math.min($(this).prop("scrollHeight"),150)) + "px";
            // });

            //调整完高度之后通知页面
            $("body").removeClass("needs-layout");

            //容器中的超过可是范围的图片滚动加载
            $(".img-entity.loading img").load_img_onscroll({parentSelector:".field-con",offScreen:1000},function(){
                $(this).closest(".img-entity").removeClass("loading").addClass("entity-loaded");
                img_entity_onload.call(this);
            },function(){
                $(this).closest(".img-entity").removeClass("loading").addClass("loadederror");
            });

            $("body.img-wall .img-entity.loading img,body.single-mode .img-entity.loading img,body.open-link .img-entity.loading img,body.ok-lightbox-on .img-entity.loading img").load_img_onscroll({container:document.getElementById("wrapper"),parentSelector:".field-con",offScreen:1000},function(){
                $(this).closest(".img-entity").removeClass("loading").addClass("entity-loaded");
                img_entity_onload.call(this);
            },function(){
                $(this).closest(".img-entity").removeClass("loading").addClass("loadederror");
            });

            $("#lightbox .lb-image").on("load",function(event){
                //更新图片尺寸
                $("#lightbox .lb-caption").text(this.width+"X"+this.height).show();
                var filename = get_filename(this.src);
                $("#lightbox a.ok-dl-img").attr({"download":filename,href:this.src});
            });

            $("#lightbox .lb-outerContainer").on("click",".lb-op-con a",function(event){
                event.stopPropagation();
                if(!this.download){
                    event.preventDefault();

                    var $img = $("#lightbox .lb-image");
                    var url = "";
                    var append_share_source = "&__sharesource=okmemo";
                    var tmp_img = $img.get(0);
                    var img_url = tmp_img && tmp_img.src;
                    var share_url = location.origin;
                    var content = (_translate("share_share_from") || "分享自")+":"+(_translate("app_name") || "Ok记")+"("+share_url+")";

                    if($(this).hasClass("ok-img-original") || $(this).hasClass("ok-img-sources")){
                        //打开原图，在新标签页打开
                        if(tmp_img){
                            
                            var newwin_height = tmp_img.height,
                                newwin_width = tmp_img.width,
                                newwin_top = (window.screen.height - newwin_height) / 2,
                                newwin_left = (window.screen.width - newwin_width) / 2;

                            window.open(tmp_img.src+"?__sharesource=okmemo",'','height='+newwin_height+',width='+newwin_width+',top='+newwin_top+',left='+newwin_left+',toolbar=no,menubar=no,scrollbars=yes,resizable=no,location=no,status=no');
                            event.preventDefault();
                        }
                    }else if($(this).hasClass("sinaweibo")){
                        url = weibo_share(content,img_url,share_url,append_share_source);
                    }else if($(this).hasClass("twitter")){
                        url = twitter_share(content,share_url,"okmemo",append_share_source);
                    }else if($(this).hasClass("plus")){
                        url = gplus_share(share_url,append_share_source);
                    }else if($(this).hasClass("wechat")){
                         //生成一个二维码
                        var tmpDiv = $("<div>",{style:"text-align:center;"}).qrcode({
                            size: 150,
                            color: '#3a3',
                            text: img_url ? img_url : content
                        });

                        popup_dialog({
                            title: _translate("scan_to_share_text"),
                            desc: tmpDiv,
                            classstr: "wechat",
                            callback: function(){
                                close_popup();
                            }
                        });
                    }else if($(this).hasClass("facebook")){
                        url = fb_share(content,share_url,append_share_source);
                    }else if($(this).hasClass("qqzone")){
                        url = qzone_share(content,img_url,"",share_url,document.title,append_share_source);
                    }else if($(this).hasClass("qqmail")){
                        url = qqmail_share(content,img_url,"",share_url,document.title,append_share_source);
                    }else if($(this).hasClass("gmail")){
                        url = gmail_share(content);
                    }else if($(this).hasClass("qqim")){
                        url = qqim_share(content,img_url,share_url,(_translate("share_share_from") || "分享自")+":"+(_translate("app_name") || "Ok记"),document.title,append_share_source);
                    }else if($(this).hasClass("tumblr")){
                        url = tumblr_share(content,img_url,share_url,append_share_source);
                    }else if($(this).hasClass("douban")){
                        url = douban_share(content,img_url,(_translate("share_share_from") || "分享自")+":"+(_translate("app_name") || "Ok记")+"("+share_url+")",append_share_source);
                    }else if($(this).hasClass("line")){
                        
                    }

                    if(url){
                        var newwin_height = 500,
                        newwin_width = 800,
                        newwin_top = (window.screen.height - newwin_height) / 2,
                        newwin_left = (window.screen.width - newwin_width) / 2;

                        window.open(url,'','height='+newwin_height+',width='+newwin_width+',top='+newwin_top+',left='+newwin_left+',toolbar=no,menubar=no,scrollbars=yes,resizable=no,location=no,status=no');
                    }

                    Tracker.sendEvent('social share',$(this).attr("class"),"lightbox");
                }else{
                    if($("body").hasClass("no-attr-dl") && !$("body").hasClass("firefox")){
                        Tracker.sendEvent('Note Operations','unable to download img');
                        if($img.length > 0){
                            var tmp_img = $img.get(0);
                            var newwin_height = tmp_img.height,
                                newwin_width = tmp_img.width,
                                newwin_top = (window.screen.height - newwin_height) / 2,
                                newwin_left = (window.screen.width - newwin_width) / 2;

                            window.open(tmp_img.src+"?__sharesource=okmemo",'','height='+newwin_height+',width='+newwin_width+',top='+newwin_top+',left='+newwin_left+',toolbar=no,menubar=no,scrollbars=yes,resizable=no,location=no,status=no');
                            event.preventDefault();
                        }
                    }
                }
            });

            $("#wrapper").on("click "+downEvent,".entities-con a.lb",function(event){
                event.preventDefault();
                Tracker.sendEvent('Common UI','open image');
            });

            //点击便签中的图片导航键
            $("#wrapper").on("click "+downEvent,".entities-con .entities-nav a",function(event){
                event.preventDefault();
                var that = this;
                var content_node = $(this).closest(".note-con").find(content_area).get(0);

                if(!content_node) return false;
                if($(this).hasClass("prev")){
                    load_image_entity(content_node,"prev");
                }else if($(this).hasClass("next")){
                    load_image_entity(content_node,"next");
                }
            });

            $("#wrapper").on("mouseup "+upEvent,content_area,function(event){
                //鼠标点击的瞬间，检测是否上下文为链接，是链接的话，给出清除链接的图标
                detect_link(this);
            });

            //touchstart,mousedown目标为文字，则进入编辑状态
            //mousedown 先于 focus
            $("#wrapper").on("mousedown "+downEvent,content_area,function(event){
                event = EventUtil.getEvent(event);
                var target = EventUtil.getTarget(event);
                var $note = $(this).closest(".note-con");

                if(!target.tagName || (target.tagName && target.tagName.toLowerCase() != "a")){
                    if(this.offsetHeight >= this.scrollHeight){
                        write_mode(this);

                        //去掉其他便签的编辑状态
                        $(".note-con.editing").removeClass("editing");
                        
                        $(this).closest(".note-con").addClass("editing").removeClass("viewing");
                        
                        //hack:解决火狐浏览器光标消失的问题
                        if(typeof window.mozRequestAnimationFrame == "function"){
                            if($(this).closest(".note-con").parent().attr("id") == "blank_sheet"){
                                //火狐下，鼠标无法通过点击来控制光标的位置，出错反而正常了，以下函数会报错
                                try{
                                    this.text();
                                }catch(e){
                                    
                                }
                                

                                $(this).focus();
                                return false;
                            }
                            
                            $(this).blur().focus();
                        }
                    }else{
                        if($note.hasClass("maximized")){
                            write_mode(this);
                        }
                        
                        //展开笔记被隐藏的部分
                        view_hidden(this);
                    }
                }
            });

            //点击进入编辑模式或打开链接
            $("#wrapper").on("click",content_area,function(event){
                event = EventUtil.getEvent(event);
                
                var thatEvent = event;
                var target = EventUtil.getTarget(event),
                    $note = $(this).closest(".note-con"),
                    oriLeft = event.pageX || event.clientX,
                    oriTop = event.pageY || event.clientY;

                //用户点击便签内容中的链接
                if(target.tagName && (target.tagName.toLowerCase() == "a")){
                    if(!$note.hasClass("editing")){
                        //在overlay中打开iframe或图片
                        if($(target).hasClass("open") && target.href){
                            if(!event.ctrlKey && !event.metaKey){
                                EventUtil.preventDefault(event);
                            }else{
                                return true;
                            }

                            //如果当前便签已经打开图片链接，则关闭
                            if($(target).hasClass("opened")){
                                $(".note-con.opened_image").removeClass("opened_image");
                                $("#img_modal").removeClass("show").find(".image_con img").remove();
                                $(target).removeClass("opened");
                                return false;
                            }
                            
                            var locurl=location.protocol;//本地协议
                            var src = target.href;
                            var anchor = src.indexOf("#");
                            var src = src.substring(anchor+1,src.length);
                            if(src.indexOf("http") != 0){
                                src = "http://"+src;
                            }



                            //显示加载状态，给用户反馈
                            $("body").addClass("loading_resource");
                            $(".resource_loading").css({top:oriTop,left:oriLeft});

                            //判断是否是图片，如果是图片则无需用frame打开
                            is_image_url(src,function(url,img){
                                $("body").removeClass("loading_resource");
                                if(!img){
                                    //给链接添加类型数据，在之后用户打开时免做判断
                                    $(target).data("type","link").addClass("type-link");

                                    //非图片
                                        //如果当前网站是https：打开的链接不是https
                                    if(locurl=="https:" && url.indexOf("https:") != 0){
                                        $("#new_windows").addClass("htps");
                                        $("#error_mask .button a").attr("href",url);
                                        $("#error_mask a.link").attr("href",url);
                                        $("#error_mask a.link").get(0).innerHTML=url;
                                    }else{
                                        $("#new_windows").removeClass("htps");
                                    }

                                    $("#new_windows iframe").get(0).src = url;

                                    
                                    push_window("open-link");

                                    var winScrollTop = Math.max($(window).scrollTop(),$("#wrapper").scrollTop());
                                    if($("body").hasClass("open-link")){
                                        //切换网址
                                        $("body").addClass("switch-link");
                                        setTimeout(function(){
                                            $("body").removeClass("switch-link");
                                        },200);                                     
                                    }else{
                                        $("body").addClass("open-link");
                                        //滚动到当前便签位置
                                        $("#wrapper").scrollTop(winScrollTop);
                                    }                                

                                    //更新搜索栏宽度
                                    stickyWidth = $('#notes_con .inner-wrapper').width();
                                    $("#search_area").width(stickyWidth);
                                    // $("#iframe_modal").show();
                                    $note.addClass("opened_page");
                                    Tracker.sendEvent('Common UI','open link');
                                }else{
                                    Tracker.sendEvent('Common UI','open image link');
                                    //给链接添加类型数据，在之后用户打开时免做判断
                                    $note.find(".note.editable a[rel=\"image\"]").attr("data-lightbox","in-memo");
                                    $(target).data("type","image").removeAttr("data-lightbox").addClass("type-image");

                                    //展示图片泡泡
                                    var filename = get_filename(url);
                                    
                                    //$("#img_modal").find(".image_con").html(img).end().addClass("show").find("a.download").attr({href:src});
                                    //if(!!filename) $("#img_modal a.download").attr("download",filename);

                                    var $img_entity = $note.find(".entities-con .img-entity a.entity img");

                                    //如果当前点击的图片链接正在展示`
                                    if($img_entity.attr("src") == url){
                                        var $con = $note.find(".entities-con .img-entity");
                                        $con.removeClass("displaying");
                                        $con.offset();
                                        $con.addClass("displaying");
                                    }
                                    
                                    if($img_entity.length > 0){
                                        var img_node = $img_entity.get(0);
                                        img_node.onload = img_entity_onload;

                                        img_node.onerror = function(){
                                            //加载失败，将图片去除
                                            $(this).closest(".img-entity").removeClass("entity-loaded");
                                            this.remove();
                                        };
                                        img_node.src = src;
                                    }else{
                                        var img_node = document.createElement("img");
                                        $note.find(".entities-con .img-entity").append("<a class=\"lb entity\" data-lightbox=\"in-memo\" href=\""+src+"\"></a><a class=\"img-downloader\" href=\""+src+"\" download=\""+filename+"\">").find("a.lb.entity").append(img_node);
                                        img_node.onload = img_entity_onload;

                                        img_node.onerror = function(){
                                            //加载失败，将图片去除
                                            $(this).closest(".img-entity").removeClass("entity-loaded");
                                            this.remove();
                                        };
                                        img_node.src = src;
                                    }
                                }
                            });
                        }
                    }else{
                        if($(target).attr("rel") == "image"){
                            EventUtil.preventDefault(event);
                            //没有按下ctrl键，也没有按下meta键，则取消默认行为
                            if(!event.ctrlKey && !event.metaKey && !event.shiftKey){
                                $note.find("a.selected").removeClass("selected");
                                $(target).addClass("selected");
                                selectText(target);
                                Tracker.sendEvent('Common UI','select image link');
                            }else{
                                return false;
                            }
                        }
                    }
                }else{
                    $note.find("a.selected").removeClass("selected");
                    $("#imglk_con").html("");
                }
            });

            //关闭图片展示窗口
            $("#img_modal").on("click "+downEvent,"a.close",function(event){
                event = EventUtil.getEvent(event);
                EventUtil.preventDefault(event);
                $(".note-con.opened_image").removeClass("opened_image");
                $("#img_modal").removeClass("show").find(".image_con img").remove();
            });

            //关闭网页展示窗口
            $("#new_windows .operations a").on("click "+downEvent,function(event){
                event.preventDefault();

                if($(this).hasClass("close")){
                    var wrapperScrollTop = $("#wrapper").scrollTop();

                    //更新搜索栏宽度
                    $(".note-con.opened_page").removeClass("opened_page");
                    $("body").removeClass("open-link");
                    $("#new_windows iframe").get(0).src="";

                    pop_window("open-link");

                    //滚动到当前便签位置
                    $(window).scrollTop(wrapperScrollTop);

                    stickyWidth = $('#notes_con .inner-wrapper').width();
                    $("#search_area").width(stickyWidth);
                }else if($(this).hasClass("blank")){
                    var newwin = window.open($("#new_windows iframe").get(0).src);
                    Tracker.sendEvent('Common UI','open link,target blank');
                }else if($(this).hasClass("fix")){

                }
            });

            //鼠标经过添加新的样式
            //函数: toggleHvr(reset,selector,hvrclass,tpSeletor,callback)
            if(!$("body").hasClass("touch-device")){
                //非触摸设备才添加hover事件
                toggleHvr(null,"#note .note-con.editing div.note.editable a[rel=\"image\"],"+
                                "#install_area .install-btn,"+
                                "#login .content-area input,"+
                                "#note .note-con form a.pin,"+
                                "#note .note-con form a.maximize-note,"+
                                "#note form div.bottom-menu,#colors a.color,"+
                                "html.in-frame,.checkbox,"+
                                "#search_area .by-tag.editing a.tag,"+
                                "#search_area .by-tag a#edit_tag,"+
                                "#search_area .by-tag a#edit_tag_finish,"+
                                "#img_modal,#settings div.nickname .name-con,"+
                                ".langs-con li.lang a,.fonts li a,"+
                                "a.drag_trigger,#note div.note.editable a.open,"+
                                "#note form div.bottom-menu a.op,"+
                                "#wrapper header .menu a,#note,"+
                                "#app_list ul li.app,section#app_list,"+
                                "#note_ops .tags.section a.tag,"+
                                "span.icon-font,"+
                                "#search_area .by-tag a.expand-tags .ok-icon-expandMore,"+
                                "#search_area .by-tag .pined-tags a.tag,"+
                                "#edit_tag .ok-icon-create,"+
                                "#search_area .by-keywords .ok-icon-search,"+
                                "#search_area .custom .by-tag a.expand-tags"
                                );

                $(document).on("mouseover.note","#note .note-con",function(){
                    $(this).addClass("hvr");
                });

                //笔记最大化的时候不让菜单隐 d藏
                $(document).on("mouseleave.note","#note .note-con",function(){
                    $(this).removeClass("hvr");
                    if(!$(this).hasClass("maximized")) $(this).removeClass("adding-tags deleting setting-deadline showing-info sharing").find(".bottom-menu a.active").removeClass("active");
                });

            }

            //让便签可排序
            if(!$("#notes_con").hasClass("sorted")){
                sort_notes();
            }
            
            //函数: toggleFocus(reset,selector,focusClass,containerselector,callback)
            toggleFocus(function(event){
                //在blur发生时调用
                //当焦点不在当前输入框，则将大于150像素的区域隐藏，(条件是下一个聚焦的元素在他的上面)
                var $note = $(this).closest(".note-con");
                if($note.hasClass("hvr") || $note.hasClass("opened_image") || $note.hasClass("opened_page")){
                    //如果用户仍然在对当前便签进行操作，则不对文本框进行调整高度
                    return false;
                }

                var event = EventUtil.getEvent(event);
                var target = EventUtil.getTarget(event);
                var relatedTarget = EventUtil.getRelatedTarget(event);

                //如果是新笔记，且已经被修改则不让其高度缩小
                var id = $note.data("id");

                if(!id && $note.hasClass("modified")){
                    $note.removeClass("editing");
                    return ;
                }


                if(relatedTarget){

                    //下一个聚焦的元素在他的上面，以免便签过长收模式缩时页面滚动太大
                    if($(content_area).index(relatedTarget) < $(content_area).index(target)){
                        configure_height(this);
                        var classStr = $(this).attr("class").replace(/expand\d{0,}\-?\d{0,}/,"expand0-150");
                        $(this).attr("class",classStr);
                    }
                }else{
                    
                    configure_height(this);
                    var classStr = $(this).attr("class").replace(/expand\d{0,}\-?\d{0,}/,"expand0-150");

                    if($(this).prop("scrollHeight") >= window.innerHeight/3 && $("body").hasClass("touch-device")){
                        $('html, body').animate({
                            scrollTop: $(this).offset().top - 15
                        }, 500);
                    }

                    $(this).attr("class",classStr);

                    //收缩的同时，去掉拖拽或者收缩的把手
                    if($("body").hasClass("touch-device")){
                        $note.find(".stick_handler").remove();
                    }
                }

                $note.removeClass("editing");

                //如果未修改则在此时返回查看模式，已经修改了的在保存后返回查看模式
                if(!$note.hasClass("modified")){
                    read_mode(this);
                }
            },".note-con "+content_area,"viewing","#notes_con .inner-wrapper "+all_saved_con+",#today,#search_results,#blank_sheet",function(event){
                //在focus发生时调用
                //当用户准备输入时，将文本框高度设为无滚动条时的高度，并改变最大高度值为999
                //this.style.height = ($(this).prop("scrollHeight")) + "px";
                var classStr = $(this).attr("class").replace(/expand\d{0,}\-?\d{0,}/,"expand0-600");
                $(this).attr("class",classStr);
                
                //移动设备上，若是便签的高度大于了屏幕高度的1/3则自动滚动到最上面
                if($(this).prop("scrollHeight") >= window.innerHeight/3 && $("body").hasClass("touch-device")){
                    $('html, body').animate({
                        scrollTop: $(this).offset().top - 15
                    }, 500);

                    //针对移动设备，同时给其添加把手，可以用来拖拽以及收缩便签的把手
                    if($("body").hasClass("touch-device")){
                        var $form = $(this).closest("form"),
                            $drag_trigger = $form.find(".drag_trigger");
                        if($drag_trigger.length > 0){
                            var top = $drag_trigger.prop("offsetTop") + $drag_trigger.height(),
                                height = $form.height() - top - 5;
                        }else{
                            var top = 5,
                                height = $form.height() - 10;
                        }
                        $form.append("<a href=\"#\" class=\"stick_handler\" style=\"height:"+height+"px;top:"+top+"px;\"></a>");
                    }
                }
            });
    
            if(!($("body").hasClass("touch-device")) && window.top == self){
                //页面打开时，让文本框自动让新记事获取焦点
                $(".note-con.new").addClass("editing").find(content_area).focus();
            }

            //设定自动保存定时器
            idl.noteint = setInterval(function(){
                //对用户正在编辑的便签进行保存
                  $(".note-con.editing").each(function(){
                        //如果便签处于已修改状态，则对其进行本地保存
                        if($(this).hasClass("modified") && !$(this).hasClass("saving")){
                            if(localStorage){
                                //本地存储,保存完后将其进行删除
                                var val = $(content_area,this).html();
                                    val = encode_content(val);
                                if($(this).data("id")){
                                    //如果是已存在的有id的
                                    //{34:{"content":"",saved:0,id:4,modified:"2013-3-3 00:00:00"}}
                                    var id = $(this).data("id");
                                    var modified_note = {content: val,modified: get_current_time(),saved:0};
                                    var modified_notes_str = localStorage.getItem("modified_notes");

                                    if(modified_notes_str){
                                        var modified_notes = JSON.parse(modified_notes_str);
                                        //更新当前保存数据
                                        modified_notes[id] = modified_note;
                                    }else{
                                        //如果本地存储中不存在此条数据，则新建一条
                                        var modified_notes = {};
                                            modified_notes[id] = modified_note;
                                    }

                                    if(console) console.log("local saved");
                                    localStorage.setItem("modified_notes",JSON.stringify(modified_notes));
                                }else{
                                    //此条数据只有一条,每次保存自动更新
                                    if($.trim(val) == "" || val.replace(/\&nbsp\;/ig,"") == ""){
                                        return false;
                                    }
                                    
                                    if(console) console.log("local saved");
                                    var new_note = {id: 0,content: val,created:get_current_time(),saved:0};
                                    localStorage.setItem("new_note",JSON.stringify(new_note));
                                }
                            }else{
                                //无本地存储则保存到服务器
                                $("form.note",this).submit();
                            }
                        }else{
                            if(localStorage){
                                if(!$(this).data("id")){
                                    if(localStorage.new_note) localStorage.removeItem("new_note");
                                }
                            }
                        }
                  });
            },1000);

            //已修改的记事在失去焦点时自动保存
            $("#wrapper").on("blur","#notes_con .note-con.modified",function(event){
                event = EventUtil.getEvent(event);
                $("form",this).submit();
                read_mode($(content_area,this).get(0));
                Tracker.sendEvent('Save Note','blur');
            });

            //移动设备因为无法检测到删除按键，故删除了内容之后不会被设为"modified"状态，所以只要是正在编辑的都直接保存
            if($("body").hasClass("touch-device")){
                //已修改的记事在失去焦点时自动保存
                $("#wrapper").on("blur","#notes_con .note-con.editing",function(event){
                    event = EventUtil.getEvent(event);
                    $("form",this).submit();
                    read_mode($(content_area,this).get(0));
                    Tracker.sendEvent('Save Note','touch device blur');
                });
            }

            /*
            * ----------打开某种高级搜索方式，以地理位置搜索时，离屏加载高德地图，以时间搜索时，离屏加载日历，以标签搜索时，离屏加载自定义便签------------
            */
            $("#search_area").on("click "+downEvent,".search",function(event){
                event = EventUtil.getEvent(event);
                EventUtil.preventDefault(event);
                $("#search_results .result").html("");

                //如果当前搜索方式是其他方式
                if(!$(this).hasClass("active")){
                    if(/by\-(\S)/.test($(this).attr("class"))){
                        var method = $(this).attr("class").match(/by\-(\S+)/)[1];
                    }else{
                        return false;
                    }

                    if($(this).hasClass("by-geo")){
                        //按地理位置搜索
                        //“离屏”加载高德地图，同时加载最近添加地点
                        if($("#map_con").hasClass("uninitialized")){
                            var spt = document.createElement("script");
                                spt.type = 'text/javascript';
                                spt.src = "http://webapi.amap.com/maps?v=1.2&key=f2fc6ad0b48f9e5bdcd3553f4b8b72ea&callback=loadSticks";
                                document.body.appendChild(spt);
                                $("#map_con").removeClass("uninitialized");
                        }

                        $("#search_area").addClass(method).addClass("active");
                        //将点击的搜索功能设为激活状态
                        $(this).addClass("active").css("left","5px");

                    }else if($(this).hasClass("by-tag")){
                        //按标签进行搜索
                        $("#search_area").addClass(method).addClass("active");
                        //将点击的搜索功能设为激活状态
                        $(this).addClass("active").css("left","5px");

                    }else if($(this).hasClass("by-device")){
                        //按设备搜索
                        $("#search_area").addClass(method).addClass("active");
                        //将点击的搜索功能设为激活状态
                        $(this).addClass("active").css("left","5px");

                    }else if($(this).hasClass("by-archive")){
                        if($("#search_results .archived").hasClass("finished") || $("#search_results .archived").hasClass("loading")){
                            $("#search_results .archived").html("").removeClass("finished");
                        }else{
                            //得到存档箱中的结果
                            get_archived_notes();
                        }
                    }else if($(this).hasClass("by-history")){
                        $("#search_area").addClass(method).addClass("active");
                        //将点击的搜索功能设为激活状态
                        $(this).addClass("active").css("left","5px");
                    }
                }
            });

            $("#search_area .by-tag .expand-tags").on("click "+downEvent,function(event){
                event = EventUtil.getEvent(event);
                EventUtil.preventDefault(event);

                if($("#search_area .search-options").hasClass("custom")){
                    $("#search_area .search-options").removeClass("custom");

                    //关闭时检测一下是否便签正处于编辑状态，若是，则退出编辑
                    if($("#search_area .by-tag").hasClass("editing")) $("#edit_tag_finish").trigger("click");
                }else{
                    $("#search_area .search-options").addClass("custom")
                }
            });

            //让标签可拖拽
            (function(){
                var mousedown = false,
                    max_pined_num = 4,
                    tag_con = null,
                    tag_con_clone = null,
                    pined_con_name = "pined-tags",
                    dropzone = $("#search_area .by-tag ."+pined_con_name).get(0),
                    pined_tags_con = $("#search_area .pined-tags").get(0),
                    unpined_tags_con = $("#search_area .custom-tags .tags-con").get(0),
                    tag_parent_con = "",
                    placeholder = null,
                    pined_num = 0,
                    diff = {};

                $(document).on("mousedown "+downEvent,"#search_area .search-options.custom .by-tag .tag-con",function(event){
                    if(!$("#search_area .by-tag").hasClass("editing")){
                        event = EventUtil.getEvent(event);
                        target = EventUtil.getTarget(event);
                        tag_con = this;
                        tag_parent_con = this.parentNode;

                        //根据拖动的元素来确定dropzone
                        if($(tag_parent_con).hasClass(pined_con_name)){
                            dropzone = $("#search_area .by-tag .custom-tags").get(0);
                        }else{
                            dropzone = $("#search_area .by-tag ."+pined_con_name).get(0);
                        }

                        pined_num = $("#search_area .by-tag ."+pined_con_name+" .tag-con").not(".clone").length;
                        var target = EventUtil.getTarget(event);
                        var posx = event.pageX || event.clientX;
                        var posy = event.pageY || event.clientY;
                        
                        //排除拖拽情况
                        //点击鼠标右键并非拖拽
                        //点击删除图标不属于拖拽
                        if(event.button != 2 && !$(target).hasClass("close") && !$(tag_con).hasClass("all") && !$(tag_con).hasClass("tmp-pined")){
                            mousedown = true;

                            //鼠标位置与顶点的偏差
                            diff.x = posx - tag_con.offsetLeft;
                            diff.y = posy - tag_con.offsetTop;
                        }
                    }
                });

                $(document).on(moveEvent+".move_tag",function(event){
                    if(mousedown){
                        event = EventUtil.getEvent(event);
                        var posx = event.pageX || event.clientX;
                        var posy = event.pageY || event.clientY;

                        if(!tag_con_clone){
                            var tag_left = tag_con.offsetLeft;
                            var tag_top = tag_con.offsetTop;

                            //拖拽的对象非标签本身，而是标签的映像
                            tag_con_clone = $(tag_con).clone(true).addClass("clone").css({position:"absolute",left:tag_left,top:tag_top,opacity:.5,"z-index":999}).get(0);
                            
                            $(tag_con).addClass("current_tag").after(tag_con_clone);

                            //占位符
                            placeholder = document.createElement("div");
                            placeholder.style.width = 0+"px";
                            placeholder.style.height = $("a.tag",tag_con).height()+"px";
                            placeholder.id = "tag_placeholder";
                            placeholder.style.zIndex = "2000";

                            //给用户提示哪里可以放下tag --> outline
                            $("#search_area .by-tag").addClass("dragging");
                            $(dropzone).addClass("dropzone");
                        }else{
                            //移动tag
                            tag_con_clone.style.left = (posx - diff.x) + "px";
                            tag_con_clone.style.top = (posy - diff.y) + "px";

                            var tag_offset = $(tag_con_clone).offset();
                            var drop_offset = $(dropzone).offset();
                            var drop_right_margin = drop_offset.left + $(dropzone).width();
                            var drop_bottom_margin = drop_offset.top + $(dropzone).height();

                            //判断当前移动的标签移到哪一个标签前面了
                            $("#search_area .by-tag .tag-con").not(".clone").each(function(){
                                //如果是"所有"标签或者是临时被固定的标签，则返回
                                //如果当前被移动的标签的鼠标位置移到了某个标签上则让此标签后退，将placeholder插入
                                if( posy < $(this).offset().top + $(this).height() && posy > $(this).offset().top ){
                                    //不能插入到"所有"标签前面，不可以插入到临时固定标签后面
                                    if( posx < $(this).width()/2 + $(this).offset().left && posx > $(this).offset().left && !$(this).hasClass("all") ){
                                        //如果固定标签少于4个则让其插入到临时固定标签的前面
                                        //否则不允许插入到临时固定标签的前面

                                        if(!$(this).hasClass("tmp-pined") //如果是非临时固定标签，则可以插入到其前面
                                            || (pined_num < 4)){
                                            $(this).before(placeholder);

                                            var pos = $(this).data("position");

                                            if(pos) $(placeholder).data("position",pos);
                                            else{
                                                $(placeholder).data("position",1);

                                                if($(this).hasClass("tmp-pined")){
                                                    //放到固定标签的最后一个
                                                    var $last_pos = $(".tag-con",pined_tags_con).not(".all").not(".tmp-pined").last();
                                                    if($last_pos){
                                                        $(placeholder).data("position",$last_pos.data("position")+1);
                                                    }
                                                }
                                            }
                                        }
                                    }else if( posx < $(this).width() + $(this).offset().left && posx > $(this).width()/2 + $(this).offset().left ){
                                        if( !$(this).hasClass("pined") 
                                            || (pined_num < max_pined_num && !$(this).hasClass("tmp-pined")) 
                                            || ( $(".current_tag.tag-con").hasClass("pined") && $(this).next(".tag-con").hasClass("tmp-pined") )
                                            || !$(this).next(".tag-con").hasClass("tmp-pined") ){
                                            
                                            $(this).after(placeholder);

                                            var pos = $(this).data("position");
                                            
                                            if(pos){
                                                $(placeholder).data("position",pos);
                                                if($(this).hasClass("pined") && !$(".tag-con.current_tag").hasClass("pined")) $(placeholder).data("position",pos+1);
                                            }
                                            else $(placeholder).data("position",1);
                                        }
                                    }

                                    //如果是临时固定标签则让placeholder放入非固定区域的第一个
                                    if($(this).hasClass("tmp-pined") && pined_num == max_pined_num && posx < $(this).width() + $(this).offset().left && posx > $(this).offset().left){
                                        $(unpined_tags_con).prepend(placeholder);
                                        var pos = $(".tag-con",unpined_tags_con).first().data("position");
                                        $(placeholder).data("position",pos);
                                    }
                                }

                            });
                        }
                        
                    }
                });

                $(document).on(upEvent+".move_tag",function(event){
                    event = EventUtil.getEvent(event);
                    if(mousedown){
                        var tag_id = $(tag_con).find("a.tag").data("id");
                        var tag = new Tag({"id":tag_id});

                        var dstpos = $(placeholder).data("position");
                        var srcpos = $(".current_tag.tag-con").data("position");
                        var pinit = undefined;
                        var callback = null;

                        //鼠标提起时，也就是放下标签时，要改变position，可能也要改变固定属性
                        //不移除原来的区域的话，则样式上不做任何改变
                        if($.contains(pined_tags_con,placeholder)){
                            //放入固定区域
                            //如果被移动标签原本就是固定标签，则在样式上不做改变

                            if(!$(tag_con_clone).hasClass("pined")){
                                pinit = 1;
                                //由非固定区域移动到固定区域，将标签固定(pinit)并且改变位置(change_position)
                                //宽度要改变，若固定区域的条目数超过一定数量，则需要将最后一个挤到非固定区域
                                if(placeholder){
                                    callback = function(){
                                        $(placeholder).before($(".current_tag.tag-con").addClass("pined").get(0));
                                    
                                        if(pined_num == max_pined_num){
                                            //将最后一个非临时固定标签挤出固定区域
                                            var last_pined = $(".pined-tags .pined").not(".tmp-pined").last().removeClass("pined").get(0);
                                            last_pined.style.width = "auto";
                                            $(unpined_tags_con).prepend(last_pined);

                                            //将其变为非固定标签
                                            var unpined_id = $("a.tag",last_pined).data("id");
                                            if(unpined_id){
                                                var unpined_tag = new Tag({id:unpined_id});
                                                unpined_tag.unpinIt(function(data){
                                                    console.log(data);
                                                });
                                            }
                                            

                                            //并将被移动的标签的宽度重新设定
                                            $(".current_tag.tag-con").width(100/max_pined_num+"%");
                                        }else{
                                            //重置所有固定标签的宽度
                                            var new_pined_num = $(".pined-tags .pined.tag-con").length;
                                            var new_pined_width = 100/new_pined_num + "%";

                                            $(".pined-tags .tag-con.pined").width(new_pined_width);
                                        }
                                    };
                                }
                            }else{
                                //固定区域内部移动，不改变固定属性，改变position
                                callback = function(){
                                    if(placeholder) $(placeholder).before($(".current_tag.tag-con").get(0));
                                };
                            }
                        }else if($.contains(unpined_tags_con,placeholder)){
                            //放入非固定区域
                            //并将被移动的标签的宽度重新设定

                            $(".current_tag.tag-con").get(0).style.width = "auto";

                            if($(tag_con_clone).hasClass("pined")){
                                //如果是固定区域的标签移动到非固定区域
                                //由固定区域移动到非固定区域，改变固定属性，改变position
                                pinit = 0;
                                if(placeholder){
                                    callback = function(){
                                        $(placeholder).before($(".current_tag.tag-con").removeClass("pined").get(0));

                                        //得到位置属性

                                        //将固定区域的标签重置宽度
                                        //重置所有固定标签的宽度
                                        var new_pined_num = $(".pined-tags .pined.tag-con").not(".clone").length;
                                        var new_pined_width = 100/new_pined_num + "%";

                                        $(".pined-tags .tag-con.pined").width(new_pined_width);
                                    }
                                }
                            }else{
                                //非固定区域内部移动，不改变固定属性，改变position
                                callback = function(){
                                    if(placeholder) $(placeholder).before($(".current_tag.tag-con").get(0));
                                };
                            }
                        }

                        if(srcpos != dstpos){
                            console.log("moved");
                            var direction = srcpos > dstpos ? "up" : "down";

                            tag.rearrange(pinit,direction,srcpos,dstpos,function(feedback){
                                if(feedback.status == "ok"){
                                    if(callback && $.isFunction(callback)){
                                        callback();
                                    }

                                    if(srcpos > dstpos){
                                        change_order("up",srcpos,dstpos);
                                    }else if(srcpos < dstpos){
                                        change_order("down",srcpos,dstpos);
                                    }else if(srcpos == dstpos){
                                        console.log("not moved");
                                    }
                                }else{
                                    showMessage({type:"error",msg:_translate("error_sort_tag") || "修改标签顺序失败",autoclose:true});
                                }

                                $(".current_tag").removeClass("current_tag");
                        
                                if(placeholder){
                                    $(placeholder).remove();
                                    placeholder = null;
                                }

                            });
                        }else{
                            console.log("not moved");
                            $(".current_tag").removeClass("current_tag");
                        
                            if(placeholder){
                                $(placeholder).remove();
                                placeholder = null;
                            }
                        }

                        if(tag_con_clone) $(tag_con_clone).remove();
                        tag_con_clone = null;
                        tag_con = null;
                        
                        //清除提醒效果
                        $(dropzone).removeClass("dragon dropzone");
                        $("#search_area .by-tag").removeClass("dragging");
                        mousedown = false;
                    }
                });
            })();

            //编辑标签
            $("#search_area").on("click","#edit_tag,#edit_tag_finish",function(event){
                event = EventUtil.getEvent(event);
                EventUtil.preventDefault(event);

                if($("#search_area .by-tag").hasClass("editing")){
                    //退出编辑状态，
                    //有颜色的变换字体颜色，去掉背景颜色，
                    //没颜色的，变成默认颜色，字体也是
                    $("#search_area .by-tag").removeClass("editing");
                    
                    $("#search_area .by-tag a.tag").each(function(){
                        var color = $(this).data("color");

                        if(!!color){
                            // $(this).css({"color":color,"background":"none"});
                        }else{
                            // $(this).css({"background":"none","color":"#666"});
                        }
                    });
                }else{
                    //进入编辑状态，标签反色
                    $("#search_area .by-tag").addClass("editing");

                    $("#search_area .by-tag a.tag").each(function(){
                        var color = $(this).data("color");
                        if(!!color){
                            // $(this).css({"color":"white","background":color});
                        }else{
                            // $(this).css({"background":"#ccc","color":"white"});
                        }
                    });
                }
            });

            //无法失焦的元素通过在body上设置鼠标按下监听器，鼠标按下的不是需要聚焦的元素，则是失焦,模拟失焦事件
            $("body").on("mousedown "+downEvent,function(event){
                event = EventUtil.getEvent(event);
                var target = EventUtil.getTarget(event);
            
                //如果当前页面有处于激活状态的元素且当前点击的元素非此激活元素
                if($(".tag-con.setting-color").length > 0 && !$.contains($(".tag-con.setting-color").get(0),target)){
                    $(".tag-con.setting-color").removeClass("setting-color");
                }

                if(target && target.parentNode && $(".note-con.editing").length > 0 && !$.contains($(".note-con.editing").get(0),target)){
                    $(".note-con.editing").removeClass("editing").not(".modified").find('.note.editable').each(function(){
                        //变为不可编辑模式
                        read_mode(this);
                    });
                }

                //当点击他处并且搜索框中无关键字时则取消搜索
                if($("#search_area").hasClass("searching-keywords") && !$.contains($("#search_area").get(0),target) && $("input.search-field").val() == ""){
                    $("#search_area").find(".close-input").trigger("click");
                }

                //当点击他处，非固定区域为展开状态时，将其隐藏
                if($("#search_area .search-options").hasClass("custom") && !$.contains($("#search_area .search-options").get(0),target)){
                    //不过不是正在对标签区域进行操作的话
                    if($("#popup_dialog .wrapper.delete-tag").length == 0) $("#search_area .search-options a.expand-tags").trigger("click");
                }

                if($(".main-header").hasClass("show-list") && !$.contains($(".massage").get(0),target)){
                    $(".main-header").removeClass("show-list");
                }

                if($(".main-header").hasClass("show-usc") && !$.contains($(".user-info").get(0),target)){
                    $(".main-header").removeClass("show-usc");
                }
            });

            //为标签改名
            $("#search_area").on("blur keydown",".tag-con input.name",function(event){
                if(event.type == "focusout" || (event.type == "keydown" && event.keyCode == 13)){
                    var $tag_con = $(this).closest(".tag-con");
                    var $tag = $tag_con.find("a.tag");
                    var that = this;
                    var ori_name = $tag.find(".tag-name").text();
                    
                    //检测名字的合法性
                    if($.trim(this.value) == "" || $.trim(this.value) == ori_name){
                        $tag_con.removeClass("renaming");
                        $(this).remove();
                        return false;
                    }

                    var duplicate = false;
                    var $duplicate_tag = null;

                    $("#search_area .tag-con .tag-name").each(function(){
                        if($.trim($(this).text()) == $.trim(that.value)){
                            $duplicate_tag = $(this).closest(".tag-con");
                            duplicate = true;
                        }
                    });

                    if(duplicate){
                        $duplicate_tag.addClass("warning");
                        showMessage({type:"error",msg: _translate("error_tag_conflict") || "有重名标签存在，更改名称失败",autoclose:true});
                        return false;
                    }

                    //保存标签名字
                    var tag = new Tag({id:$tag.data("id")});
                    tag.rename(this.value,function(data){
                        console.log(data);
                        var feedback = get_json_feedback(data);

                        if(feedback.status == "ok"){
                            $tag_con.removeClass("renaming");
                            $tag_con.find(".tag-name").text(that.value);
                            $(that).remove();

                            //更新底部菜单
                            $("#note_ops a.tag[data-id=\""+tag.id+"\"] span.tag-name").text(that.value);
                        }else{
                            //更改名称失败
                            $tag_con.removeClass("renaming");
                            $(that).remove();
                            
                            var msg = "更改标签名称失败"
                            switch(feedback.error){
                                case "duplicate":
                                    msg = _translate("error_tag_conflict") || "名字为\""+that.value+"\"的标签已经存在";
                                    break;
                                case "invalid parameter":
                                    msg = _translate("error_invalid_parameters") || "参数不正确";
                                    break;
                                default: break;
                            }
                            showMessage({type:"error",msg:msg});
                        }
                    });
                }
                
            });

            //点击删除图标，出现确认对话框
            $("#search_area").on("click",".tag-con .del-tag",function(event){
                var $tag_con = $(this).closest(".tag-con");
                if($tag_con.hasClass("default")){
                    showMessage({type:"error",msg:_translate("error_tag_undeletable") || "抱歉，默认标签不可被删除",autoclose:true});
                    return false;
                }

                $tag_con.addClass("deleting");
                var tag_name = $(this).closest(".tag-con").find(".tag-name").text();
                //弹出对话框，提供的参数包括标题，描述，要给对话框wrapper添加的类
                var title = "";
                var desc = _translate("popup_del_tag_desc",tag_name) || "确认删除名字为\""+tag_name+"\"的标签吗，标签删除之后将不可恢复?";
                var classstr = "delete-tag";

                popup_dialog({
                    title: title,
                    desc: desc,
                    classstr: classstr,
                    cancelText: _translate("btn_cancel_del_tag") || "先不删",
                    confirmText: _translate("btn_confirm_del_tag") || "确认删除",
                    callback: function(){
                        var $tag = $tag_con.find("a.tag");
                        var tag = new Tag({id:$tag.data("id")});
                        tag.del(function(feedback){
                            if(feedback.status == "ok"){
                                //删除成功

                                //如果是临时固定标签，则在非固定区域的克隆也要被删掉
                                if($tag_con.hasClass("tmp-pined")){
                                    $("#search_area .tmp-hidden").remove();
                                }
                                
                                $tag_con.fadeOut(function(){
                                    $(this).remove();

                                    //如果删除的是固定区域的标签，则更新宽度
                                    if($tag_con.hasClass("pined")){
                                        var new_width = (100/$(".pined-tags .pined.tag-con").length) + "%";
                                        $(".pined-tags .pined.tag-con").width(new_width);
                                    }
                                });

                                //删除底部菜单中对应的标签
                                $("#note_ops .tags a.tag[data-id=\""+tag.id+"\"]").remove();
                            }else{
                                showMessage({type:"error",msg:_translate("error_deletion_failed") || "删除标签失败",autoclose:true});
                            }
                        });

                        //关闭确认对话框
                        close_popup();
                    }
                });
            });
            //         confirm_tag_deletion(tag_name,function(){
            //             var $tag = $tag_con.find("a.tag");
            //             var tag = new Tag({id:$tag.data("id")});
            //             tag.del(function(data){
            //                 var feedback = get_json_feedback(data);
            //                 if(feedback.status == "ok"){
            //                     //删除成功
            //                     idl.LM.updateTag({
            //                         type: "delete",
            //                         id: tag.id
            //                     });

            //                     //如果是临时固定标签，则在非固定区域的克隆也要被删掉
            //                     if($tag_con.hasClass("tmp-pined")){
            //                         $("#search_area .tmp-hidden").remove();
            //                     }
                                
            //                     $tag_con.fadeOut(function(){
            //                         $(this).remove();

            //                         //如果删除的是固定区域的标签，则更新宽度
            //                         if($tag_con.hasClass("pined")){
            //                             var new_width = (100/$(".pined-tags .pined.tag-con").length) + "%";
            //                             $(".pined-tags .pined.tag-con").width(new_width);
            //                         }
            //                     });

            //                     //删除底部菜单中对应的标签
            //                     $("#note_ops .tags a.tag[data-id=\""+tag.id+"\"]").remove();

            //                 }else{
            //                     showMessage({type:"error",msg:_translate("error_failed_delete_tag") || "删除标签失败"});
            //                 }
            //             });

            //             //关闭确认对话框
            //             close_popup();
            //         });
            // });


            //确认或者取消对话框
            $("#popup_dialog").on("click",".wrapper .btn,.overlay",function(event){
                event.preventDefault();

                if($(this).hasClass("cancel") || $(this).hasClass("close") || $(this).hasClass("overlay")){
                    close_popup();
                }
            });

            //点击标签，展示属于此标签的便签
            $("#search_area").on("click "+downEvent,".pined-tags a.tag,.custom-tags a.tag",function(event){
                event = EventUtil.getEvent(event);
                EventUtil.preventDefault(event);

                //如果是在编辑模式下
                if($("#search_area .by-tag").hasClass("editing")){
                    var target = EventUtil.getTarget(event);
                    var tag_id = $(this).data("id");
                    var $tag = $(this);
                    var tag = new Tag({id:tag_id});
                    var is_current_panel = (tag_id == $("#search_area .by-tag .tag.active").data("id"));

                    if($(target).hasClass("close")){
                        //删除标签
                        $tag.addClass("to-be-deleted").fadeOut(function(){
                            //提示可撤销操作
                            $("#search_area").after("<div class=\"feedback-hint\">"+(_translate("msg_tag_deleted") || "该标签已被删除")+"<a href=\"#\" data-event=\"del_tag\" id=\"revocate\">"+(_translate("btn_revoke") || "撤销")+"</a></div>");
                            var delete_tag_timeout = setTimeout(function(){
                                if($tag.hasClass("to-be-deleted")){
                                    //删除便签
                                    tag.del(function(data){
                                        if(console) console.log(data);
                                        var feedback = get_json_feedback(data);
                                        if(feedback.status && feedback.status == "ok"){
                                            $tag.remove();
                                            if(is_current_panel){
                                                //如果删除的是当前打开的tag，则返回笔记面板
                                                $("#tag_notes").trigger("click");
                                            }
                                        }else{
                                            showMessage({type:"error",msg:_translate("error_deletion_failed") || "删除失败"});
                                            //还原
                                            $tag.removeClass("to-be-deleted").fadeIn();
                                        }

                                        //隐藏提示
                                        $(".feedback-hint").fadeOut("fast",function(){$(this).remove();});
                                    });
                                }else{
                                    clearTimeout(delete_tag_timeout);
                                }
                            },2500);
                        });
                    }else if($(target).hasClass("tag-name")){
                        if($(target).closest(".tag-con").hasClass("default") || $(target).closest(".tag-con").hasClass("all")) return false;
                        //为标签重命名
                        var value = $.trim($(target).text());
                        var width = $(target.parentNode).outerWidth();
                        var top = $(target.parentNode).css("margin-top");
                        var left = $(target.parentNode).css("margin-left");
                        $(target).closest(".tag-con").addClass("renaming");
                        $(target.parentNode).after("<input type=\"text\" class=\"name\" style=\"top:"+top+";left:"+left+";width:"+width+"px;\" value=\""+value+"\">");
                        $('input.name').focus().select();
                    }
                    return false;
                }

                //如果是在非编辑模式下且为当前打开面板则不允许再次点击
                if($(this).hasClass("active")){
                    return false;
                }

                //进入另一个标签则隐藏非固定区域
                $("#search_area .search-options").removeClass("custom");

                //将上一次的结果缓存起来
                var $last_active_tag = $("#search_area .tag.active");
                $("#search_area .by-tag .tag[data-id=\""+$last_active_tag.data("id")+"\"]").data({last_refresh:get_current_time()});

                $last_active_tag.removeClass("active").parent().removeClass("active");

                //将点击的标签设为激活状态
                $(this).addClass("active").parent().addClass("active");

                //如果点击的是所有，则离开搜索模式，展示所有
                var $tag = $(this),
                    tag_id = $(this).data("id"),
                    tag_name = $(this.firstChild).text(),
                    results_con = "#search_results .by-tag .tag-result.tag-"+tag_id;

                var tag = new Tag({id:tag_id});

                //给不同的分类加以区别，为做不同的样式做准备
                if($(this).hasClass("default-tag") && this.id && this.id.match(/tag\_([a-z]+)/)){
                    $("#search_results").removeAttr("class").addClass("results-of-"+this.id.match(/tag\_([a-z]+)/)[1]);
                }else{
                    $("#search_results").removeAttr("class").addClass("custom-tag-results");
                }

                // $("#search_results h2 span.title").text(tag_name);
                $("#search_results h2 span.num").text("");


                //清空搜索结果
                $("#search_results .by-tag").removeClass("finished").find(".tag-result.show").removeClass("show");


                //如果当前面板为任务面板，则将新添加的任务放入以后区域
                if($("#search_results").hasClass("results-of-tasks")){
                    divide_task_area();
                    var new_tasks = new Array();
                    $(".note-con.newly_saved.task").each(function(){
                        if($(this).offset().top < $(".today-area").offset().top){
                            new_tasks.push(this);
                        }
                    });
                    
                    for(var i=0; i<new_tasks.length; i++){
                        $(".later-area").after(new_tasks[i]);
                    }
                }

                //得到并展示结果
                //如果之前有打开过则直接展示，否则到本地缓存中取
                var $exist_con = $("#search_results .by-tag .tag-result.tag-"+tag_id);
                if($exist_con.length > 0){
                    var num = $exist_con.find(".note-con").length;
                    $("#search_results h2 span.num").text("("+num+")");
                    $exist_con.addClass("show");
                }else{
                    tag.list_notes();
                }

                //此次打开的面板记录下来
                //若此次打开的标签是处在隐藏区域，则将其提到可见区域(即固定标签区域)，并将上次提上去的标签取下来
                Note.prototype.save_last_opened(tag_id,!$tag.parent().hasClass("pined"),function(data){
                    //如果打开的是还未固定的标签，则将其临时固定到固定栏，替换之前先将原来的临时固定标签删除
                    if(!$tag.parent().hasClass("pined")){
                        $(".pined-tags .tag-con.tmp-pined.pined").remove();
                        $tag.parent().clone(true,true).addClass("tmp-pined pined").appendTo($(".pined-tags").get(0));
                        $(".pined-tags .tag-con.pined").width((100/$(".pined-tags .tag-con.pined").length)+"%");
                        $(".tag-con.tmp-hidden").removeClass("tmp-hidden");
                        $tag.parent().addClass("tmp-hidden");
                    }
                });

                return false;

                //清空搜索结果
                $("#search_results .by-tag").removeClass("finished").find(".tag-result.show").fadeOut(function(){$(this).removeClass("show")});

                //$("#search_results .by-tag").html("").removeClass("finished");
                $(".inner-wrapper").addClass("searching");

                
                //查看之前是否有数据缓存
                if(!!!$(this).data("last_refresh") && !!!$(this).data("num")){
                    //无缓存则直接去服务器取数据
                    get_notes_in_tag(tag_id);
                }else{
                    //有缓存则检查缓存是否有效
                    var last_refresh = $(this).data("last_refresh");
                    var num = $(this).data("num");
                    var that = this;

                    if(!!!last_refresh){
                        get_notes_in_tag(tag_id);
                        return false;
                    }

                    //除了检查更新时间外，还需要检查,tag中的条目数是否改变
                    Note.prototype.check_cache_status(tag_id,last_refresh,num,function(data){
                        if(console) console.log(data);

                        var feedback = get_json_feedback(data);
                        if(feedback.status && feedback.status == "ok"){
                            //if(feedback.cache_status == "invalid" || $(that).data("results") === undefined){
                            if(feedback.cache_status == "invalid" || $("#search_results .by-tag .tag-result.tag-"+tag_id).length == 0){
                                //如果后台有新数据或其他变更导致缓存不准确，则从新加载
                                $(that).removeClass("finished");
                                //清空上次搜索结果
                                $("#search_results .by-tag .tag-result.tag-"+tag_id).html("");
                                //得到新的结果
                                get_notes_in_tag(tag_id);
                            }else{
                                //缓存可用，使用缓存
                                $("#search_results h2 span.num").text("("+$(that).data("num")+")");
                                //$("#search_results .by-tag").html($(that).data("results"));
                                $("#search_results .by-tag .tag-result.tag-"+tag_id).fadeIn(function(){$(this).addClass("show")});
                            }
                        }else{
                            showMessage({type:"error",msg:"刷新失败",autoclose:true});
                        }
                    });
                }
            });

            //打开关键字搜索字段
            $("#search_area").on("click "+downEvent,".by-keywords .ok-icon-search",function(event){
                event = EventUtil.getEvent(event);
                EventUtil.preventDefault(event);
                var target = EventUtil.getTarget(event);
                if(target.tagName && target.tagName.toLowerCase() == "input") return false;
                switch_search();
            });

            

            $("#search_area .by-keywords a.close-input").on("click "+downEvent,function(event){
                event = EventUtil.getEvent(event);
                EventUtil.preventDefault(event);

                //关闭搜索框
                switch_search();
            });

            //切换搜索方式
            function switch_search(){
                if(!$("#search_area").hasClass("searching-keywords")){
                    //重新返回所有便签
                    $("#search_area").addClass("searching-keywords");
                    var $title_field = $("#search_results h2 span.title"),
                        $num_field = $("#search_results h2 span.num");

                    $title_field.data("last_title",$title_field.text());
                    $num_field.data("last_num",$num_field.text());

                    //关闭标签展开区域
                    if($("#search_area .search-options").hasClass("custom")){
                        $("#search_area .by-tag a.expand-tags").trigger("click");
                    }

                    //将搜索框展开，标签搜索栏隐藏
                    $("#search_area .by-tag").animate({left:"100%"});
                    $("#search_area .by-keywords").animate({width:"100%"});
                    $("#search_area .by-keywords input").focus();

                    $("#search_results").removeAttr("class");
                }else{
                    $("#search_area .by-tag").animate({left:"0"});
                    $("#search_area .by-keywords").animate({width:"40px"},function(){
                        $("#search_area").removeClass("searching-keywords");
                        var $title_field = $("#search_results h2 span.title");
                        var $num_field = $("#search_results h2 span.num");
                        
                        //清除搜索内容
                        $('input.search-field').val('');

                        //还原标题与数量
                        var last_num = $num_field.data("last_num") ? $num_field.data("last_num") : "";
                        var last_title = $title_field.data("last_title") ? $title_field.data("last_title") : "";
                        $title_field.text(last_title);
                        $num_field.text(last_num);

                        //隐藏搜索结果部分
                        $("#search_results .by-keywords").html("").hide();

                        //展示tag下的内容
                        $("#search_results .by-tag").show();
                    });
                }
            }

            //清除高级搜索结果，返回高级搜索选择界面
            $("#search_area a.deactive").on("click "+downEvent,function(event){
                event = EventUtil.getEvent(event);
                EventUtil.preventDefault(event);

                //重置搜索区域状态?
                //得到当前激活了高级搜索方法,
                if(/by\-(\S)/.test($("#search_area .search.active").attr("class"))){
                    var cur_method = $("#search_area .search.active").attr("class").match(/by\-(\S+)/)[1];
                    $("#search_area").removeClass(cur_method)
                }

                $("#search_area").removeClass("active");
                $(".search.active").css("left",$(".search.active").data("pos-left")).removeClass("active");

                //清空搜索结果
                $("#search_results .result").html("");

                //隐藏高级选项(关闭日历，地图，自定义标签)
                $("#search_area").removeClass("cal-on map-on custom-on devices-expanded");
            });

            //添加搜索监听事件
            $("#wrapper").on("submit","form.notes-search",function(event){
                event = EventUtil.getEvent(event);
                EventUtil.preventDefault(event);

                var field = this.note_keywords,
                    keyword = this.note_keywords.value;

                if($.trim(keyword) == ""){
                    return false;
                }
            });

            function display_results(keywords,results_con){
                    keywords = keywords;
                var i=0,
                    keyword,
                    note_cons = "#notes_con .note-con",//所有被搜索便签
                    results_con = !!results_con ? results_con : ".results",
                    results = new Array(),
                    second_results = new Array();

                var keywords_str = keywords.replace(/[\,\.\;\'\"\`\!\-\+\，\。\；\‘\：\”\·\！\？\、]/g," ").toLowerCase(),
                    split_words = keywords_str.split(" "),
                    word_len = split_words.length,
                    frequency;

                //便签区域成为搜索状态，便签都成为不可拖拽状态，在取消搜索后去除，(关闭搜索结果框，或者关键字为空时)
                $("#notes_con").addClass("searching");

                //将搜索结果清空
                $(results_con).html("");

                //首先在当前页面中搜索
                //1.包含能够匹配所有用户输入关键字的记事 如一条记事匹配到 “css and design"
                //2.包含能够分别匹配用户输入的所有关键字的记事 如一条记事分别匹配到 “css” 和 “design”
                //权重依次降低

                //1.
                $(note_cons).not(".hidden").each(function(){
                    var data = $(this).data();
                    for(var prop in data){
                        //移出已经加上去的数据，避免上次的数据影响这次搜索结果
                        if(/^freq(\-)?\S+/.test(prop)){
                            $(this).removeData(prop);
                        }
                    }

                    var $note = $(this).find(content_area),
                        content = !!$note.html() ? $note.html().toLowerCase() : "";

                    if(content.indexOf(keywords) > -1){
                        results.push(this);
                    }
                });

                //2.
                //not(".hidden") 排除没有文本框的便签
                $(note_cons).not(".hidden").each(function(){
                    var $note = $(this).find(content_area),
                        content = !!$note.html() ? $note.html().toLowerCase() : "";

                        //在第一步中取的东西排除
                        if(content.indexOf(keywords) == -1){
                            var j=0;
                            for(i=0; i<word_len; i++){
                                keyword = split_words[i];
                                if(keyword != "" && content.indexOf(keyword) > -1){
                                    //得出出现的单词的个数
                                    j++;
                                    //得出单词出现的频度
                                    $(this).data("freq-"+keyword,content.split(keyword).length - 1);
                                }
                            }

                            if(j > 0){
                                $(this).data("keyword-num",j);
                                second_results.push(this);
                            }
                        }
                });
                
                //处理得到的second_results的展示顺序
                second_results.sort(function(a,b){
                    if($(a).data("keywordNum") > $(b).data("keywordNum")){
                        //返回false不调换顺序
                        return -1;
                    }else if($(a).data("keywordNum") == $(b).data("keywordNum")){
                        //如果此时两者的单词个数都是一样
                        //则比较比较哪一个节点的匹配频度高些
                        var adata = $(a).data(),
                            bdata = $(b).data(),
                            afreq = bfreq = 0;

                        for(var prop in adata){
                            if(bdata[prop] && /^freq(\-)?\S+/.test(prop)){
                                if(!isNaN(adata[prop]) && !isNaN(bdata[prop])){
                                    //将各个单词出现的频率做累加
                                    bfreq += bdata[prop];
                                    afreq += adata[prop];
                                }
                            }
                        }
                        
                        if(afreq > bfreq){
                            return -1;
                        }else{
                            return 1;
                        }
                    }else{
                        //调换a,b顺序
                        return 1;
                    }
                });
                
                var last_results = results.concat(second_results),
                    exclude_ids = new Array(),
                    limit = 4;

                //去掉搜索完成标识，以便继续搜索
                $(results_con).removeClass("finished");
                
                if(keywords.length > 0){
                    for(var i=0,len=last_results.length; i<len; i++){
                        var note = last_results[i];
                        var $clone = $(note).clone(true,true);
                        $(results_con).append($clone);
                        var content_con = $clone.find('.note.editable').get(0);
                        
                        //高亮关键字
                        highlight_text(keywords,content_con);

                        //先让内容都展示以便找到内容中的关键字
                        content_con.style.height = content_con.scrollHeight;

                        var scroll = 0;
                        var $kws = $(content_con).find('.kws-highlight');
                        
                        if($kws.length > 0 && $kws.offset().top - $(content_con).offset().top > 150 ){
                           scroll = $kws.offset().top - $(content_con).offset().top;
                        }

                        configure_height(content_con);
                        load_image_entity(content_con);
                        if(scroll) $(content_con).scrollTop(scroll);

                        exclude_ids.push($(note).data("id"));
                    }
                }


                //得到最终返回结果的长度
                var results_len = $("#search_results .by-keywords .note-con").length;

                $("#search_results h2 span.num").text("("+results_len+")");

                //给结果加上完成标识
                $(results_con).addClass("finished");


                //进入服务器进入全库搜索
                //需要先检测用户的输入状态以及关键字的长度
                // if(keywords.length >= 2){
                //     //排除掉已经搜索出的结果
                //     var offset = last_results.length,
                //         $existed_results = new Array();

                //     //搜索要分次搜索，以免一次结果太多导致页面卡死
                //     //未登录页面无需搜索服务器
                //     //search_notes(keywords,exclude_ids,limit);
                // }
            }

            //按下回车键时立即搜索
            $("input.search-field").on("keydown",function(){
                event = EventUtil.getEvent(event);

                if(event.keyCode && event.keyCode == "13"){
                    var keywords = $.trim(this.value.toLowerCase());
                    
                    if(keywords == ""){
                        $("#search_results .by-keywords").html("");
                        return false;
                    }

                    clearTimeout(idl.search_delay);
                    display_results(keywords,"#search_results .by-keywords");
                    EventUtil.preventDefault(event);
                }
            });

            //在搜索框内键入时进行搜索
            $("input.search-field").on("propertychange input keyup",function(event){
                event = EventUtil.getEvent(event);

                if(this.value.toLowerCase() == $(this).data("keywords")){
                    return false;
                }

                var keywords = $.trim(this.value.toLowerCase());

                //清除上次的timeout
                clearTimeout(idl.search_delay);

                var $title_field = $("#search_results h2 span.title");
                var $num_field = $("#search_results h2 span.num");

                //有输入则改变标题
                if(keywords.length > 0){
                    $title_field.text(_translate("title_search_results",keywords) || "\""+keywords+"\"的搜索结果");
                    $num_field.text("");
                    $("#search_results .by-tag").hide();
                    $("#search_results .by-keywords").show();
                }

                //如果输入为空
                if(keywords == ""){
                    var last_num = $num_field.data("last_num") ? $num_field.data("last_num") : "";
                    var last_title = $title_field.data("last_title") ? $title_field.data("last_title") : "";
                    $title_field.text(last_title);
                    $num_field.text(last_num);
                    $("#search_results .by-keywords").html("").hide();
                    $("#search_results .by-tag").show();
                    return false;
                }

                $(this).data("keywords",keywords);

                //输入完成2s之后展示结果
                idl.search_delay = setTimeout(function(){
                    display_results(keywords,"#search_results .by-keywords");
                },600);
            });

            //获得标签下的便签
            function get_notes_in_tag(tag_id,limit,offset_id){
                if(isNaN(tag_id) || tag_id <= 0){
                    return false;
                }

                //限制一次取出数据
                limit = !!limit ? limit : 10;

                //设置偏移便签数量，默认从0取起
                offset_id = !!offset_id ? offset_id : 0;
                
                if(offset_id == 0){
                    //如果是第一次取，则将总数也取出，另外，也将这一次访问的tag_id保存
                    Note.prototype.get_num_in_tag(tag_id,function(data){
                        var feedback = get_json_feedback(data);
                        if(feedback.num != undefined){
                            $("#search_results h2 span.num").text("("+feedback.num+")");
                            $("#search_area .by-tag a.tag[data-id=\""+tag_id+"\"]").data("num",feedback.num);

                            //放入全局变量中缓存标签数据
                            // if(!idl.apps.note.tag["tag_"+tag_id]){
                            //     idl.apps.note.tag["tag_"+tag_id] = {};
                            // }
                            // idl.apps.note.tag["tag_"+tag_id].num = feedback.num;
                        }
                    });
                }

                //如果不存在乘装结果的容器，则创建一个
                if($("#search_results .by-tag .tag-result.tag-"+tag_id).length == 0){
                    $("#search_results .by-tag").append("<div class=\"tag-result tag-"+tag_id+"\"></div>");
                }
                console.log($("#search_results .by-tag .tag-result.tag-"+tag_id).length);
                var tag_notes_con = $("#search_results .by-tag .tag-result.tag-"+tag_id).fadeIn(function(){$(this).addClass("show")}).get(0);

                Note.prototype.get_notes_in_tag(tag_id,limit,offset_id,function(data){
                    var feedback = get_json_feedback(data),noteobj,note,notes;

                    var note_html = "";
                    if(feedback.notes && feedback.notes.length > 0){
                        console.log(feedback.notes.length);
                        notes = feedback.notes;

                        //放入全局变量中缓存标签数据
                        // if(!idl.apps.note.tag["tag_"+tag_id]){
                        //     idl.apps.note.tag["tag_"+tag_id] = {};
                        // }

                        // if(!idl.apps.note.tag["tag_"+tag_id].notes){
                        //     idl.apps.note.tag["tag_"+tag_id].notes = [];
                        // }

                        // var ori_tag_notes = idl.apps.note.tag["tag_"+tag_id].notes;
                        // idl.apps.note.tag["tag_"+tag_id].notes = ori_tag_notes.concat(notes);

                        for(var i=0,len=notes.length; i<len; i++){
                            noteobj = notes[i];
                            note = new Note(noteobj);
                            note.construct_item("newly_loaded");
                            note_html += note.html;
                        }
                        
                        var offset_id = notes[len-1].id;

                        $(tag_notes_con).append(note_html);

                        if(!$("#search_area a.tag.active").hasClass("finished")){
                            $(".note-con.newly_loaded",tag_notes_con).each(function(){
                                var $note = $(this).find(content_area);
                                if($note.length > 0){
                                    $note.data("value",$note.html());
                                    var content = decode_content($note.html());
                                    $note.html(content);
                                    configure_height($note.get(0));
                                }
                                load_image_entity($note.get(0));
                                $(this).removeClass("newly_loaded");
                            });
                            
                            highlight_colored_tags();

                            //再次搜索
                            //当前取出的数量小于需要取出的数量则继续取
                            if($(".note-con",tag_notes_con).length < cache_num){
                                var num_left = 50 - $(".note-con",tag_notes_con).length;
                                if(num_left < limit){
                                    //重置limit值为num_left
                                    limit = num_left;
                                }
                                get_notes_in_tag(tag_id,limit,offset_id);
                            }else{
                                //将加载的任务交给滚动加载
                                //给出搜索完成标识
                                
                                //今日任务分出
                                divide_task_area();
                                return false;
                            }
                        }
                    }else{
                        //结果返回空则是搜索结束
                        console.log("finished");

                        //如果是任务标签，则继续加载已完成的便签
                        if(tag_id == $("#tag_tasks").data("id")){
                            var num_left = 50 - $(".note-con",tag_notes_con).length;
                            divide_task_area();
                            if(num_left > 0){
                                //继续取没取完的num_left条，可能剩下的条条目数小于num_left
                                var offset_id = 0;
                                Note.prototype.load_finished(num_left,offset_id,function(data){
                                    var feedback = get_json_feedback(data),noteobj,note,notes;
                                    var note_html = "";
                                    if(feedback.notes && feedback.notes.length > 0){
                                        notes = feedback.notes;

                                        for(var i=0,len=notes.length; i<len; i++){
                                            noteobj = notes[i];
                                            
                                            note = new Note(noteobj);
                                            note.construct_item("newly_loaded");
                                            note_html += note.html;
                                        }

                                        $(tag_notes_con).append(note_html);

                                        $(".note-con.newly_loaded",tag_notes_con).each(function(){
                                            var $note = $(this).find(content_area);
                                            if($note.length > 0){
                                                $note.data("value",$note.html());
                                                var content = decode_content($note.html());
                                                $note.html(content);
                                                configure_height($note.get(0));
                                            }
                                            load_image_entity($note.get(0));
                                            $(this).removeClass("newly_loaded");
                                        });

                                        var results_length = $(".note-con",tag_notes_con).length;
                                        
                                        highlight_colored_tags();

                                        if(feedback.notes.length < num_left){
                                            //剩下的完成了的便签不足limit条，即已经取完
                                            $("#search_area #tag_tasks").addClass("finished");

                                            //今日任务分出
                                            divide_task_area();
                                        }
                                        return false;
                                    }
                                });
                            }
                        }else{
                            //所有此标签里地便签不超过cache_num
                            //给出搜索完成标识
                            $("#search_area a.tag.active").addClass("finished");
                        
                            $(".note-con.newly_loaded",tag_notes_con).each(function(){
                            var $note = $(this).find(content_area);
                            if($note.length > 0){
                                    $note.data("value",$note.html());
                                    var content = decode_content($note.html());
                                    $note.html(content);
                                    configure_height($note.get(0));
                                }
                                $(this).removeClass("newly_loaded");
                                load_image_entity($note.get(0));
                            });
                            
                            highlight_colored_tags();
                            return false;
                        }
                    }
                });
            }

            function load_finished(limit,offset_id){
                limit = !!limit ? limit : 4;
                offset_id = !!offset_id ? offset_id : 0;
                console.log(offset_id);
                var tasks_con = $("#search_results .by-tag .tag-result.tag-"+$("#tag_task").data("id")).get(0);
                Note.prototype.load_finished(limit,offset_id,function(data){
                    console.log(data);
                    var feedback = get_json_feedback(data),noteobj,note,notes;
                    var note_html = "";
                    if(feedback.notes && feedback.notes.length > 0){
                        notes = feedback.notes;

                        for(var i=0,len=notes.length; i<len; i++){
                            noteobj = notes[i];
                            
                            note = new Note(noteobj);
                            note.construct_item("newly_loaded");
                            note_html += note.html;
                        }

                        var offset_id = notes[len-1].id;

                        $(tasks_con).append(note_html);
                        //$("#search_results .by-tag").append(note_html);

                        //如果搜索未完成
                        if(!$("#search_area #tag_tasks").hasClass("finished")){
                            //再次搜索
                            load_finished(limit,offset_id);
                        }
                    }else{
                        //给出搜索完成标识
                        $("#search_area #tag_tasks").addClass("finished");
                        $(".note-con.newly_loaded",tasks_con).each(function(){
                            var $note = $(this).find(content_area);
                            if($note.length > 0){
                                $note.data("value",$note.html());
                                var content = decode_content($note.html());
                                $note.html(content);
                                configure_height($note.get(0));
                                load_image_entity($note.get(0));
                            }
                            $(this).removeClass("newly_loaded");
                        });

                        var results_length = $(".note-con",tasks_con).length;
                        
                        highlight_colored_tags();
                        return false;
                    }
                });
            }

            function search_notes(keywords,exclude_ids,limit){
                var limit = !!limit ? limit : 4;
                var results_con = "#search_results .by-keywords";
                Note.prototype.search(keywords,exclude_ids,limit,function(data){
                    var feedback = get_json_feedback(data),noteobj,note,notes;
                    var append_html = "";
                    if(feedback.notes && feedback.notes.length > 0){
                        notes = feedback.notes;
                        for(var i=0,len=notes.length; i<len; i++){
                            noteobj = notes[i];
                            if(noteobj.id){
                                //将新得到的id加到排除id序列中
                                exclude_ids.push(parseInt(noteobj.id));
                            }
                            
                            note = new Note(noteobj);
                            note.construct_item();

                            append_html += note.html;
                            
                        }
                        $(results_con).append(append_html);
                        $(results_con).find(content_area).each(function(){
                            configure_height(this);
                        });

                        //如果搜索未完成
                        if(!$(results_con).hasClass("finished")){
                            //再次搜索
                            search_notes(keywords,exclude_ids,limit);
                        }
                    }else{
                        //结果返回空则是搜索结束
                        //给出搜索完成标识
                        $("#notes_con").removeClass("searching");

                        //得到最终返回结果的长度
                        var results_len = $("#search_results .by-keywords .note-con").length;

                        //显示搜索标题，如”24条搜索结果“
                        $("#search_results h2 span.title").text(_translate("title_search_results",keywords) || "\""+keywords+"\"的搜索结果");
                        $("#search_results h2 span.num").text("("+results_len+")");

                        //给结果加上完成标识
                        $(results_con).addClass("finished");
                        return false;
                    }
                });
            }

            function get_archived_notes(exclude_ids,limit){
                limit = !!limit  && limit > 0 ? limit : 5;
                exclude_ids = !!exclude_ids ? exclude_ids : new Array();
                var results_con = "#search_results .archived";
                $(results_con).addClass("loading");
                Note.prototype.get_archived_notes(exclude_ids,limit,function(data){
                    var feedback = get_json_feedback(data),noteobj,note,notes;
                    
                    if(feedback.notes && feedback.notes.length > 0){
                        notes = feedback.notes;
                        for(var i=0,len=notes.length; i<len; i++){
                            noteobj = notes[i];
                            if(noteobj.id){
                                //将新得到的id加到排除id序列中
                                exclude_ids.push(parseInt(noteobj.id));
                            }
                            
                            note = new Note(noteobj);
                            note.construct_item();
                            $(results_con).append(note.html);
                        }

                        if(!$(results_con).hasClass("finished")){
                            get_archived_notes(exclude_ids,limit);
                        }

                    }else{
                        $(results_con).addClass("finished").removeClass("loading");
                        return false;
                    }
                });
            }

            function load_from_archive(exclude_ids,limit){
                limit = !!limit  && limit > 0 ? limit : 5;
                exclude_ids = !!exclude_ids ? exclude_ids : new Array();
                Note.prototype.get_archived_notes(exclude_ids,limit,function(data){
                    var feedback = get_json_feedback(data),noteobj,note,notes;
                    
                    if(feedback.notes && feedback.notes.length > 0){
                        notes = feedback.notes;
                        for(var i=0,len=notes.length; i<len; i++){
                            noteobj = notes[i];
                            if(noteobj.id){
                                //将新得到的id加到排除id序列中
                                exclude_ids.push(parseInt(noteobj.id));
                            }
                            
                            note = new Note(noteobj);
                            note.construct_item("newly_loaded").display_items();
                            //调整所有新出现的便签的高度
                            $("#notes_con .note-con.newly_loaded").each(function(){
                                var $note = $(this).find(content_area);
                                if($note.length > 0){
                                    configure_height($note.get(0));
                                }
                                $(this).removeClass("newly_loaded");
                            });
                            highlight_colored_tags();
                        }
                        load_from_archive(exclude_ids,limit);
                    }else{
                        if(console) console.log("archived ends");
                        return false;
                    }
                });
            }
            
            //便签的底部菜单(bottom menu)加载日历
            $(".cal-con").datepicker({
                //选中日历中得某一天时，设置这一天为便签的最后期限，并将便签转为任务
                onSelect: function(date,params){
                    var target = $(".cal-con.hasDatepicker td a.ui-state-hover").get(0),
                        deadline = date,
                        that = this,
                        $note = $(this).closest(".note-con"),
                        note_id = $note.data("id"),
                        task_id = $note.data("task-id"),
                        dead_day = target.parentNode,
                        note = new Note({id:note_id});
                        
                        //不允许将任务期限设为今日之前，只能规划未来和今天
                        if($(dead_day).hasClass("disabled")){
                            return false;
                        }

                        //如果当前便签已经是任务
                        if(!!task_id && task_id > 0){
                            //如果点击的日期已经为deadline，则将其任务删除，在从任务标签中移除
                            //由于每次点击都会促发showDay事件，必须先将日历中的deadline数据移出
                            if($(dead_day).hasClass("deadline")){
                                //如果点击的日期已经为deadline，则将此任务设为无截止日期任务，不将其删除，若取消的是今日任务(即截止日期小于或等于今天)则需要更改position，移动到以后区域，若取消的是未来任务则无需更新position
                                note.task_id = task_id;
                                note.deadline = null;

                                NotificationCenter.remove({id:note_id,task_id:note.task_id});

                                note.setDeadline(function(feedback){
                                    if(feedback.status == "ok"){
                                        //更新本地数据
                                        idl.LM.updateNote({
                                            type: "task",
                                            value: null,
                                            id: note.id
                                        });

                                        $note.find("form div.deadline").remove();
                                        $("td.deadline",that).removeClass("deadline");
                                        $note.removeData("deadline").removeAttr("data-deadline");
                                        
                                        var today = get_formated_time(Date.now(),false);
                                        var formated_date = get_formated_time(date,false);

                                        //若取消的是今日或今日之前未完成的任务
                                        if(new Date(formated_date).valueOf() <= new Date(today).valueOf() || $note.hasClass("today")){
                                            recount_today_tasks("change_date");
                                            
                                            //如果是在任务面板，
                                            if($("#search_results").hasClass("results-of-tasks")){
                                                divide_task_area();

                                                if(feedback.position){
                                                    //更新position
                                                    var srcpos = $note.data("position");
                                                    var dstpos = feedback.position;
                                                    change_position("down",srcpos,dstpos);
                                                }

                                                //移动到以后区域
                                                if($(".later-area").length > 0){
                                                    var top_offset = $note.offset().top - $(window).scrollTop();
                                                    $(".later-area").after($note.get(0));
                                                    scroll_into_view($note.get(0),-top_offset);
                                                }
                                            }

                                        }
                                    }else{

                                    }
                                });
                            }else{
                                //否则改变deadline日期期限
                                note.deadline = date;
                                var formated_date = get_formated_time(date,false);
                                $note.data("deadline",formated_date).attr("data-deadline",formated_date);
                                var $last_deadline = $(".cal-con.hasDatepicker td.deadline");

                                NotificationCenter.queue({
                                    id: note.id,
                                    task_id: task_id,
                                    deadline: date,
                                    content: process_sharetext($note.find(".editable").html())
                                });

                                note.setDeadline(function(feedback){

                                    //在调用此回调函数之前，日历已经被刷新,dead_day已经被从document中去掉
                                    //更改截止期限成功
                                    if(feedback.status && feedback.status == "ok"){
                                        
                                        idl.LM.updateNote({
                                            type: "task",
                                            value: note.deadline,
                                            id: note.id
                                        });

                                        //在便签线面展示deadline
                                        var $deadline = $note.find("form .deadline");
                                        if($deadline.length > 0){
                                            $deadline.find("span").text(note.deadline);
                                        }else{
                                            $note.find("form").append("<div class=\"deadline\"><span>"+note.deadline+"</span></div>");
                                            $deadline = $note.find("form .deadline");
                                        }

                                        $deadline.removeClass("highlight").offset();
                                        $deadline.addClass("highlight");

                                        var formated_date = get_formated_time(date,false);
                                        $note.data("deadline",formated_date).attr("data-deadline",formated_date);

                                        //如果是在任务面板下，还要做一些额外的操作
                                        if($("#search_results").hasClass("results-of-tasks")){
                                            //如果deadline恰好为今天，则将本便签放入“今天”的任务列表
                                            var today = get_formated_time(Date.now(),false);
                                            var $note_con = $(that).closest(".note-con");

                                            divide_task_area();

                                            //若原截止日期为今日或今日以前
                                            //将截止日期设为今日，不管是今日还是以后区域的任务都放到今日第一条
                                            if( new Date(formated_date).valueOf() == new Date(today).valueOf() ){
                                                recount_today_tasks("change_today");

                                                $note_con.addClass("today");
                                                if(feedback.position){
                                                    //更新position
                                                    var srcpos = $note.data("position");
                                                    var dstpos = feedback.position;
                                                    change_position("up",srcpos,dstpos);
                                                }

                                                //判断今日区域是否存在
                                                if($(".today-area").length > 0){
                                                    $(".today-area").after($note.get(0));
                                                }else{
                                                    //如不存在，则创建今日区域，
                                                    divide_task_area();
                                                    $(".today-area").after($note.get(0));
                                                }

                                                var top_offset = $note.offset().top - $(window).scrollTop();
                                                scroll_into_view($note.get(0),-top_offset);
                                            }

                                            //将截止日期设为未来
                                            if( new Date(formated_date).valueOf() > new Date(today).valueOf() ){
                                                //如果被设置日期的是今日区域的便签，则拖到以后区域的第一条
                                                if($note_con.hasClass("today")){
                                                    recount_today_tasks("change_date");

                                                    if(feedback.position){
                                                        //更新position
                                                        var srcpos = $note_con.data("position");
                                                        var dstpos = feedback.position;
                                                        change_position("down",srcpos,dstpos);
                                                    }

                                                    //移动到以后区域
                                                    if($(".later-area").length > 0){
                                                        var top_offset = $note_con.offset().top - $(window).scrollTop();
                                                        $(".later-area").after($note.get(0));
                                                        scroll_into_view($note_con.get(0),-top_offset);
                                                    }
                                                }

                                                //如果被设置日期的是以后区域的便签，则不动                                                
                                            }
                                        }else{
                                            //在非任务面板，更新position
                                            if(feedback.position){
                                                $note.data("position",feedback.position).attr("data-position",feedback.position);
                                            }
                                        }
                                    }else{
                                        showMessage({"type":"error","msg":_translate("error_change_deadline") || "更改截止期限失败",autoclose:true});
                                        var year = $last_deadline.data("year"),
                                            month = $last_deadline.data("month"),
                                            day = $last_deadline.find("a").text();

                                        //改变截止日期失败，将日期还原
                                        $(".cal-con.hasDatepicker tr td[data-month=\""+month+"\"]").each(function(){
                                            if($("a",this).text() == day){
                                                $(this).addClass("deadline");
                                            }
                                        });
                                    }
                                });
                            }
                        }else{
                            //如果当前便签不是任务，则创建一个，另外也要加上tasks标签
                            note.deadline = date;//2014-02-28

                            //将任务加入通知中心
                            NotificationCenter.queue({
                                id:note.id,
                                deadline:date,
                                content:process_sharetext($note.find(".editable").html())
                            });

                            note.setTask(function(feedback){
                                if(console) console.log(feedback);
                                if(feedback.status && feedback.status == "ok"){
                                    
                                    //如果此便签没有任务标签，则为其加上tasks标签
                                    if(!$note.hasClass("task")){
                                        var task_tid = $("#tag_tasks").data("id");
                                        note.addTag(task_tid,function(feedback){
                                            if(feedback.status == "ok"){
                                                //更新本地数据
                                                idl.LM.updateNote({
                                                    type: "tag",
                                                    value: "+"+task_tid,
                                                    id: note.id
                                                });

                                                notify_user({operation:"add_tag",node:$("#tag_tasks").get(0),effect:"default"});

                                                //添加上标签色块
                                                var that = $("#tag_tasks").get(0),
                                                    color = $(that).data("color"),
                                                    $form = $note.find("form");

                                                //先添加任务标签，然后再给上日期，以防止页面闪动
                                                $note.addClass("task");

                                                if(!!color){
                                                    $form.append("<div class=\"default_tag\" data-id=\""+$("#tag_tasks").data("id")+"\" style=\"background:"+color+"\"></div>");
                                                    
                                                    var note_con = $note.addClass("highlighted").get(0);
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
                                                }

                                                $form.append("<div class=\"deadline\"><span>"+note.deadline+"</span></div>");
                                            }
                                        });
                                    }

                                    //将当前选中日期设为deadline
                                    $(".ui-datepicker-current-day").addClass("deadline");


                                    if(feedback.task_id && feedback.task_id > 0){
                                        //将任务id加入便签中
                                        $note.data({"task-id":feedback.task_id,"deadline":date}).attr({"data-task-id":feedback.task_id,"data-deadline":date});

                                        if(feedback.position){
                                            $note.data("position",feedback.position).attr("data-position",feedback.position);
                                        }

                                        //如果deadline恰好为今天，则将本便签放入“今天”的任务列表
                                        //var today = get_formated_time(Date.now(),false) + " 00:00:00";
                                        //var formated_date = get_formated_time(date,false) + " 00:00:00";
                                        //火狐与iPad在new Date中传入的参数若加上了 "00:00:00",则返回invalid date
                                        //new Date(2014,2,23);在所有浏览器中都如愿显示，不会自动设为凌晨8点
                                        var today = get_formated_time(Date.now(),false);
                                        var formated_date = get_formated_time(date,false);

                                        var $deadline = $note.find("form .deadline");
                                        if($deadline.length > 0){
                                            $deadline.find("span").text(note.deadline);
                                        }else{
                                            $note.find("form").append("<div class=\"deadline\"><span>"+note.deadline+"</span></div>");
                                            $deadline = $note.find("form .deadline");
                                        }

                                        $deadline.removeClass("highlight").offset();
                                        $deadline.addClass("highlight");
                                        //是否在任务面板则需要针对选择的截止日期做移动操作
                                        // if($("#search_results").hasClass("results-of-tasks")){
                                        //     //如果设定的日期是今天或今天以前，则需要放到今日任务中
                                        //     if(new Date(formated_date).valueOf() == new Date(today).valueOf()){
                                        //         note.moveToToday(function(data){
                                        //             if(console) console.log(data);
                                        //             var feedback = get_json_feedback(data);
                                        //             if(feedback.status == "ok"){
                                        //                 //如果是为今日添加任务
                                        //                 //更新今日任务数量
                                        //                 //为当前便签添加今日任务的样式
                                        //                 recount_today_tasks("addnew");
                                        //                 $note.addClass("today");

                                        //                 var top_offset = $note.offset().top - $(window).scrollTop();
                                        //                 //将便签移动到今日任务区域，放在最上面
                                        //                 //判断今日区域是否存在
                                        //                 if($(".today-area").length > 0){
                                        //                     $(".today-area").after($note.get(0));
                                        //                 }else{
                                        //                     //如不存在，则创建今日区域，
                                        //                     divide_task_area();
                                        //                     $(".today-area").after($note.get(0));
                                        //                 }
                                        //                 //更新顺序
                                        //                 regen_tasks_order();

                                        //                 scroll_into_view($note.get(0),-top_offset);
                                        //             }else{
                                        //                 //出错
                                        //             }
                                        //         });
                                        //     }else{
                                        //         //在以后，则放入"later"区域，
                                        //         //因为没有截止日期的便签默认是在"later"区域，所有无需作任何操作
                                        //     }
                                        // }else{
                                        //     //不在任务面板

                                        // }
                                    }
                                }
                            });
                        }
                },

                dateFormat: "yy-mm-dd",

                beforeShowDay: function(date){
                    $(".ui-datepicker-current-day").removeClass("ui-datepicker-current-day");
                    $("a.ui-state-active").removeClass("ui-state-active");
                    var $note = $(".cal-con").closest(".note-con");

                    if($note.length != 0){
                        //如果当前便签没有deadline 数据，则得到当前便签的deadline
                        var deadline = $note.data("deadline"),
                            curdate = get_formated_time(date,false),
                            today = get_formated_time(Date.now(),false),
                            note_id = $note.data("id"),
                            note = new Note({id:note_id});

                        var formated_date = get_formated_time(deadline,false);
                            
                        if(new Date(curdate).valueOf() < new Date(today).valueOf()){
                            //对比deadline与所有日期，是deadline则给予高亮
                            if(new Date(curdate).valueOf() == new Date(formated_date).valueOf()){
                                if(console) console.log("calendar has been reloaded");
                                return [true,"deadline disabled"];
                            }
                            return [true,"disabled"];
                        }else if(new Date(curdate).valueOf() == new Date(today).valueOf()){
                            //对比deadline与所有日期，是deadline则给予高亮
                            if(new Date(curdate).valueOf() == new Date(formated_date).valueOf()){
                                if(console) console.log("calendar has been reloaded");
                                return [true,"deadline today"];
                            }
                            return [true,"today"];
                        }

                        if(!deadline){
                            
                        }else{
                            //对比deadline与所有日期，是deadline则给予高亮
                            if(new Date(curdate).valueOf() == new Date(formated_date).valueOf()){
                                if(console) console.log("calendar has been reloaded");
                                return [true,"deadline"];
                            }
                        }
                    }
                    return [true,""];
                }
            });

            //去除链接
            $("#wrapper").on("click "+downEvent,"a.clear-link",function(event){
                event.preventDefault();

                delink();
                $(this).closest("form.note").submit();
                Tracker.sendEvent('Save Note','clear link');
            });

            /*-------------------------- 单条便签最大化编辑 ----------------------------*/
            //扩大便签编辑范围
            $("#wrapper").on("click","a.maximize-note",function(event){
                event.preventDefault();
                var $note = $(this).closest(".note-con");
                var winScrollTop = $(window).scrollTop() || $("#wrapper").scrollTop();
                var offset_top = $note.offset().top;
                //其他最大化的便签
                var $maximized_notes = $(".note-con.maximized").find(".minimize-note").trigger("click");

                $("body").addClass("single-mode");
                var top = 20;

                var note_height = $note.height();
                
                // var y_pos = offset_top + note_height/2;
                // $note.css("-webkit-transform-origin","0% "+y_pos+"px");
                $note.width(310);

                var maximize_placeholder = "<div id=\"maximize_placeholder_"+$note.data("id")+"\" style=\"width:auto;height:"+note_height+"px;visibility:hidden\"></div>";



                $note.addClass("maximizing").after(maximize_placeholder).css("top",(offset_top-winScrollTop)+"px").animate({
                    left: ($("#note").width()+50)+"px"
                },{
                    duration: 300,
                    done:function(){
                        //如果当前没有打开底部菜单，则默认打开标签选择
                        $note.removeClass("maximizing").addClass("maximized").css({"top":top+"px",width:"auto"});
                        $("#maximize_placeholder_"+$note.data("id")).fadeOut();
                        if($note.find(".bottom-menu .op a.active").length == 0){
                            $note.find(".bottom-menu a.tags").trigger("click");
                        }

                        //editable 区域的最大和最小高度
                        var minHeight = maxHeight = 0;
                        var maxHeight = $(window).height() - 60 - 230;
                        var minHeight = maxHeight - 230;
                        $note.find(".note.editable").css({"max-height":maxHeight + "px","min-height":minHeight + "px"});

                        push_window("single-mode");
                    }
                });

                //滚动到当前便签位置
                $("#wrapper").scrollTop(winScrollTop);

                //更新搜索栏宽度
                stickyWidth = $('#notes_con .inner-wrapper').width();
                $("#search_area").width(stickyWidth);

                document.documentElement.style.paddingRight = '1px';
                Tracker.sendEvent('Note Operations','maximize');
            });

            //将最大化的窗口固定
            $("#wrapper").on("click",".note-con a.pin",function(event){
                event.preventDefault();

                var $note = $(this).closest(".note-con");
                if($note.hasClass("maximized")){
                    //减去10像素的margin
                    $note.css({"top":($note.offset().top - 10 - $(window).scrollTop()) + "px"}).addClass("fixed");
                }
            });

            //将最大化的窗口解开固定
            $("#wrapper").on("click",".note-con a.unpin",function(event){
                event = EventUtil.getEvent(event);
                EventUtil.preventDefault(event);

                var $note = $(this).closest(".note-con");
                if($note.hasClass("fixed")){
                    //减去10像素的margin
                    $note.css({top:($note.offset().top - 10) +"px"}).removeClass("fixed");
                }
            });

            //最小化便签
            $("#wrapper").on("click","a.minimize-note",function(event){
                event.preventDefault();
                var wrapperScrollTop = $("#wrapper").scrollTop();
                var $body = $("body");

                $body.removeClass("single-mode").removeClass("note-highest");
                pop_window("single-mode");

                var $note = $(this).closest(".note-con");
                var maximize_placeholder = $("#maximize_placeholder_"+$note.data("id")).show();

                $note.addClass("minimizing").animate({
                    left: 0,
                    top: maximize_placeholder.offset().top
                },{
                    duration: 500,
                    done: function(){
                        $("#maximize_placeholder_"+$note.data("id")).remove();
                        $note.removeClass("maximized fixed").removeClass("minimizing").find(".bottom-menu .op a.active").trigger("click");

                        //将便签高度重置
                        $note.find(".note.editable").css({"min-height":"1em","max-height":""}).each(function(){
                            //设定高度
                            configure_height(this);

                            this.style.overflow = "hidden";
                            read_mode(this);
                        }).end().css({'top':'auto','left':'auto'}).removeClass("editing");
                    }
                });

                //更新搜索栏宽度
                stickyWidth = $('#notes_con .inner-wrapper').width();
                $("#search_area").width(stickyWidth);

                //滚动到当前便签位置
                $body.scrollTop(wrapperScrollTop);
                Tracker.sendEvent('Note Operations','minimize');
            });
            /*------------------------ 单条便签最大化编辑结束 -------------------------*/


            //点击记事本菜单中的操作时
            $("#wrapper").on("click",".bottom-menu .op a",function(event){
                event = EventUtil.getEvent(event);
                EventUtil.preventDefault(event);

                var $note = $(this).closest(".note-con");
                var bottom_menu = $(this).closest(".bottom-menu").get(0);
                if($note.length == 0){
                    return false;
                }
                
                if($(this).hasClass("active")){
                    $(this).removeClass("active");
                }else{
                    $(".bottom-menu .op a.active").removeClass("active");
                    $(this).addClass("active");
                }

                //确保只附上一个菜单
                if($note.find("#note_ops").length == 0) $note.append(note_ops);

                //每当打开关闭面板时，一切应该还原，现在时去掉选中状态
                $("a.tag.choosed",note_ops).removeClass("choosed").each(function(){
                    if($(this).data("color")){
                        $(this).css({background:"none",color:$(this).data("color")});
                    }
                });

                var id = $note.data("id"),
                    note = new Note({id:id});

                if($(this).hasClass("share")){
                    if($note.hasClass("sharing")){
                        $note.removeClass("sharing");
                    }else{
                        $(".note-con.adding-tags,.note-con.deleting,.note-con.setting-deadline,.note-con.showing-info,.note-con.sharing").removeClass("adding-tags deleting setting-deadline showing-info sharing");
                        //列出分享组件
                        //1.邮箱 --> 给出邮箱以及正文输入地址，正文附上便签内容及网址
                        //2.微博 --> 按照微博的方式分享，微博内容中附上便签内容及网址
                        $note.addClass("sharing").removeClass("adding-tags setting-deadline deleting showing-info");
                    }
                    Tracker.sendEvent('Note Operations','share');
                }else if($(this).hasClass("cal")){
                    if($note.hasClass("setting-deadline")){
                        $note.removeClass("setting-deadline");
                    }else{
                        $(".note-con.adding-tags,.note-con.deleting,.note-con.setting-deadline,.note-con.showing-info,.note-con.sharing").removeClass("adding-tags deleting setting-deadline showing-info sharing");
                        //给出一个日历，
                        //点选后即设置deadline,并将便签转为任务
                        $note.addClass("setting-deadline").removeClass("sharing adding-tags deleting showing-info");
                        //刷新日历
                        $( ".cal-con" ).datepicker( "refresh" );
                    }
                    Tracker.sendEvent('Note Operations','set deadline');
                }else if($(this).hasClass("tags")){
                    if($note.hasClass("adding-tags")){
                        $note.removeClass("adding-tags");
                    }else{
                        $(".note-con.adding-tags,.note-con.deleting,.note-con.setting-deadline,.note-con.showing-info,.note-con.sharing").removeClass("adding-tags deleting setting-deadline showing-info sharing");
                        //得到词便签的标签，然后将便签给予高亮
                        //为便签设置分组或标签，暂未定名字
                        $note.addClass("adding-tags").removeClass("setting-deadline sharing deleting showing-info");

                        note.get_tag_ids(function(feedback){
                            
                            if(feedback.tag_ids && feedback.tag_ids.length > 0){
                                var tag_ids = feedback.tag_ids,tag_id,$tag,color;

                                for(var i=0,len=tag_ids.length; i<len; i++){
                                    tag_id = tag_ids[i];
                                    $tag = $("#note_ops .custom a.tag[data-id=\""+tag_id+"\"]");
                                    $tag.addClass("choosed");
                                    color = $tag.data("color");
                                    if(color) $tag.css({background:color,color:"white"});
                                }
                            }
                        });
                    }
                    Tracker.sendEvent('Note Operations','view tags');
                }else if($(this).hasClass("del")){
                    $(".note-con.adding-tags,.note-con.deleting,.note-con.setting-deadline,.note-con.showing-info,.note-con.sharing").removeClass("adding-tags deleting setting-deadline showing-info sharing");
                    
                    //直接执行删除操作
                    var id = $note.data("id"),
                        note = new Note({id:id});
                    
                        if($(".note-con.to-be-deleted").length > 0){
                            $(".feedback-hint").remove();
                        }
                        
                        // hugo adder
                        $note.addClass("to-be-deleted",function(){
                        //提示可撤销操作
                        //$note.before("<div class=\"feedback-hint\">"+(_translate("msg_note_deleted") || "该便签已被放入垃圾箱")+"<a href=\"#\" data-event=\"del\" data-id=\""+note.id+"\" id=\"revocate\">"+(_translate("btn_revoke") || "撤销")+"</a></div>");
                        var deleteView = 
                                '<div class="rec-d-wrapper">'
                                    +'<div class="rec-d-box">'
                                        +'<span class="ok-icon-delete icon-font rec-d-icon"></span>'
                                        +'<span class="rec-d-text">正在删除...</span>'
                                        +'<span class="rec-d-line">|</span>'
                                        +'<a class="rec-d-revocate" href="#" data-event=\"del\" data-id=\"'+ note.id +'\" id=\"revocate\">撤销</a>'
                                    +'</div>'
                                    +'<div class="rec-d-progress-box">'
                                        +'<div class="rec-d-progress-all"></div>'
                                        +'<div class="rec-d-progress-run"></div>'
                                    +'</div>'
                                +'</div>';

                        $note.append(deleteView);

                        var delete_note_timeout = setTimeout(function(){
                                if($note.hasClass("to-be-deleted")){
                                    //删除便签
                                    note.del(function(feedback){
                                        if(feedback.status && feedback.status == "ok"){
                                            //如果是任务则将其删除
                                            if($note.hasClass("task")){
                                                NotificationCenter.remove({id:note.id});
                                            }
                                            //更新本地数据
                                            idl.LM.updateNote({
                                                type: "delete",
                                                id: note.id
                                            });

                                            //在删除前，将底部菜单保留
                                            $note.find("#note_ops").appendTo("body");
                                            $note.remove();
                                            recount_in_tag("delete");
                                            //隐藏提示
                                            $(".feedback-hint").fadeOut("fast",function(){$(this).remove();});
                                        }else{
                                            showMessage({type:"error",msg:_translate("error_deletion_failed") || "删除失败"});
                                            //还原
                                            $note.removeClass("to-be-deleted deleting").fadeIn();
                                            $("feedback-hint").remove();
                                        }
                                    });
                                }else{
                                    clearTimeout(delete_note_timeout);
                                }
                            },3000);
                            // hugo added
                            $('#revocate[data-id="' + note.id + '"]').data('reId', delete_note_timeout);
                        });
                        Tracker.sendEvent('Note Operations','delete');
                    // if($note.hasClass("deleting")){
                    //     $note.removeClass("deleting");
                    // }else{
                    //     $(".note-con.adding-tags,.note-con.deleting,.note-con.setting-deadline,.note-con.showing-info,.note-con.sharing").removeClass("adding-tags deleting setting-deadline showing-info sharing");
                    //     $note.addClass("deleting");
                    // }
                }else if($(this).hasClass("info")){
                    //取得信息
                    if($note.hasClass("showing-info")){
                        $note.removeClass("showing-info");
                    }else{
                        $(".note-con.adding-tags,.note-con.deleting,.note-con.setting-deadline,.note-con.showing-info,.note-con.sharing").removeClass("adding-tags deleting setting-deadline showing-info sharing");
                        $note.addClass("showing-info").removeClass("setting-deadline sharing deleting adding-tags");
                        
                        note.get_info(function(feedback){
                            //data中应该包含便签的记事地点，创建时间，修改时间，设备名称
                            //info:{lnglat:"112.00323|23.23432",create_time:"2013-32-23 00:23:12",modified_time:"2013-32-23 00:23:12",device:"Android网页版"}

                            //先展示时间与设备，因为地理位置需要向服务器发送请求才能得到
                            if(feedback.modified_time && feedback.modified_time != "0000-00-00 00:00:00" && feedback.modified_time != ""){
                                //若修改了则展示修改时间
                                $("#note_ops .info").addClass("has-modified");
                                $("#note_ops .info .modified-time .content").text(feedback.modified_time);
                            }else{
                                $("#note_ops .info").removeClass("has-modified");
                            }

                            if(!!feedback.source){
                                $("#note_ops .info").addClass("has-source");
                                $("#note_ops .info .source .content").text(feedback.source).attr("href",feedback.source);
                            }else{
                                $("#note_ops .info").removeClass("has-source");
                            }

                            $("#note_ops .info .create-time .content").text(feedback.create_time);
                            $("#note_ops .info .device .content").text(feedback.device);

                            //展示地理位置，利用百度提供的逆地理编码服务
                            if(!!feedback.lnglat){
                                if(console) console.log(feedback.lnglat);
                                if(!!$note.data("loc")){
                                    $("#note_ops .info .location .content").text($note.data("loc"));
                                }else{
                                    var lng = feedback.lnglat.split("|")[0],
                                        lat = feedback.lnglat.split("|")[1],
                                        latlng = lat + "," + lng,
                                        lnglat = lng + "," + lat;
                                        if(console) console.log(lnglat);
                                    if(navigator.language.toLowerCase().indexOf("zh") >= 0){
                                        $.getScript("/agent/baidu/geocoder?callback=renderReverse&latlng="+lnglat);
                                    }else{
                                        $.get("/agent/google/geocoder?latlng="+lnglat,function(data){
                                            var loc = null;
                                            if(data){
                                                try{
                                                    var response = get_json_feedback(data);

                                                    if(response.status == "OK" && response.results.length > 0){
                                                        if(response.results.length > 1){
                                                            var result = response.results[1];
                                                        }else{
                                                            var result = response.results[0];
                                                        }
                                                        loc = result.formatted_address;
                                                        $(".geo-web span.loc").text(loc);
                                                        $("#note_ops .info .location .content").text(loc).closest(".note-con").data("loc",loc);
                                                    }else{
                                                        //获取失败

                                                    }
                                                }catch(e){

                                                }
                                            }

                                            if(!loc){
                                                $.getScript("/agent/baidu/geocoder?callback=renderReverse&latlng="+lnglat);
                                            }

                                        });
                                    }
                                }
                            }else{
                                if(!!$note.data("loc")){
                                    $("#note_ops .info .location .content").text($note.data("loc"));
                                }else{
                                    $("#note_ops .info .location .content").text(_translate("info_pos_unknown") || "未知地点");
                                }
                            }
                        });
                        
                    }
                    Tracker.sendEvent('Note Operations','view detail');
                }else if($(this).hasClass("more")){
                    if($(bottom_menu).hasClass("all")){
                        //已经被打开，则关闭
                        $(bottom_menu).removeClass("all");
                        $note.find(".deadline").show();
                    }else{
                        //打开，先关闭所有其他已经打开的菜单
                        $(".bottom-menu").removeClass("all");
                        $(bottom_menu).addClass("all");
                        $note.find(".deadline").hide();
                        
                        //滚动即关闭
                        // if($("body").hasClass("touch-device")){
                        //     $(document).one(moveEvent,function(event){
                        //         $(".bottom-menu").removeClass("all");
                        //         $(".note-con.adding-tags,.note-con.deleting,.note-con.setting-deadline,.note-con.showing-info,.note-con.sharing").removeClass("adding-tags setting-deadline showing-info sharing");
                        //     });
                        // }
                    }
                }
            });

            //确认删除
            $("#wrapper").on("click",".del-confirm a.button",function(event){
                event = EventUtil.getEvent(event);
                EventUtil.preventDefault(event);

                var $note = $(this).closest(".note-con");
                var id = $note.data("id"),
                    note = new Note({id:id});
                if($(this.parentNode).hasClass("confirm")){
                    //确认删除便签
                    if($(".note-con.to-be-deleted").length > 0){
                        $(".feedback-hint").addClass("warning");
                        return false;
                    }
                    
                    $note.addClass("to-be-deleted").fadeOut("fast",function(){
                        //提示可撤销操作
                        $note.before("<div class=\"feedback-hint\">"+(_translate("msg_note_deleted") || "该便签已被放入垃圾箱")+"<a href=\"#\" data-event=\"del\" id=\"revocate\">撤销</a></div>");
                        var delete_note_timeout = setTimeout(function(){
                            if($note.hasClass("to-be-deleted")){
                                //删除便签
                                note.del(function(data){
                                    //如果是任务则将其删除
                                    if($note.hasClass("task")){
                                        NotificationCenter.remove({id:note.id});
                                    }

                                    var feedback = get_json_feedback(data);
                                    if(feedback.status && feedback.status == "ok"){
                                        //更新本地数据
                                        idl.LM.updateNote({
                                            type: "delete",
                                            id: note.id
                                        });

                                        //在删除前，将底部菜单保留
                                        $note.find("#note_ops").appendTo("body");
                                        $note.remove();
                                        recount_in_tag("delete");
                                        //隐藏提示
                                        $(".feedback-hint").fadeOut("fast",function(){$(this).remove();});

                                    }else{
                                        showMessage({type:"error",msg:_translate("error_deletion_failed") || "删除失败"});
                                        //还原
                                        $note.removeClass("to-be-deleted deleting").fadeIn();
                                        $("feedback-hint").remove();
                                    }
                                });
                            }else{
                                clearTimeout(delete_note_timeout);
                            }
                        },2500);
                    });
                }else if($(this.parentNode).hasClass("cancel")){
                    //取消删除
                    $note.removeClass("deleting").find("a.del.active").removeClass("active");
                }
            });

            $("body").on("click "+downEvent,"#revocate",function(event){
                event = EventUtil.getEvent(event);
                EventUtil.preventDefault(event);

                var theEvent = $(this).data("event");
                var that = this;
                if(theEvent){
                    if(theEvent == "del"){
                        // hugo changed
                        var $that = $(this).closest('.to-be-deleted');
                        var clearT = $(this).data('reId');
                        clearTimeout(clearT);
                        $(".note-con.to-be-deleted").each(function(){
                            if($(this).data("id") == $that.data("id")){
                                $that.find('.rec-d-wrapper').hide();
                                $that.removeClass("to-be-deleted deleting").fadeIn().find("a.del.active").removeClass("active");
                            }
                        });
                    }else if(theEvent == "move"){
                        // hugo changed
                        var $that = $(this).closest('.to-be-moved');
                        var clearT = $(this).data('retagId');
                        clearTimeout(clearT);
                        $(".note-con.to-be-moved").each(function(){
                             if($(this).data("id") == $that.data("id")){
                                 $that.find('.rec-m-wrapper').hide();
                                 $that.removeClass("to-be-moved adding-tags").fadeIn().find("a.del.active").removeClass("active");
                             }
                        });
                    }else if(theEvent == "del_tag"){
                        $("#search_area .tag.to-be-deleted").removeClass("to-be-deleted").fadeIn();
                    }
                    $(this).parent().remove();
                }
            });

            $("#note_ops .share.section .at-box input.at-field").on("focus",function(event){
                $(".at-box").addClass("active");
            });

            //点击分享组件弹出分享窗口
            $("#note_ops").on("click",".share .component",function(event){
                event = EventUtil.getEvent(event);
                EventUtil.preventDefault(event);

                var $note_con = $(this).closest(".note-con");
                
                //分享内容必须去掉html标记，且需要将实体空格装换
                var $contentdiv = $note_con.find("div.note.editable");
                var content = $contentdiv.data("value");

                if(content === undefined){
                    content = encode_content($contentdiv.html());
                    $contentdiv.data("value",content);
                }
                var links = get_links(content);

                var img_url = "";
                if(links.length > 0){
                    for(var i=0,len=links.length; i<len; i++){
                        var link = links[i];
                        if(link.match(/[^\/]+\.(?:png|jpg|jpeg|svg|bmp|gif|tiff)\b/i)){
                            img_url = link;
                            break;
                        }
                    }
                }

                content = process_sharetext(content);

                //如果链接中没有带有图片特有后缀的则看是否有已经标明为图片的
                if(img_url == ""){
                    var $img = $note_con.find("a.type-image").first();
                    if($img.length > 0) img_url = get_link_in_url($img.attr("href"));
                }

                var newwin_height = 500,
                newwin_width = 800,
                newwin_top = (window.screen.height - newwin_height) / 2,
                newwin_left = (window.screen.width - newwin_width) / 2;

                Tracker.sendEvent('social share',$(this).attr("class"));

                var url = "";
                var append_share_source = "&__sharesource=okmemo";
                if($(this).hasClass("sinaweibo")){
                    url = weibo_share(content,img_url,location.origin,append_share_source);
                }else if($(this).hasClass("douban")){
                    url = douban_share(content,img_url,(_translate("share_share_from") || "分享自")+":"+(_translate("app_name") || "Ok记")+"("+location.origin+")",append_share_source);
                }else if($(this).hasClass("qqmail")){
                    //分享到QQ邮箱
                    url = qqmail_share(content,img_url,"",location.origin,document.title,append_share_source);
                }else if($(this).hasClass("qqzone")){
                    url = qzone_share(content,img_url,"",location.origin,document.title,append_share_source);
                }else if($(this).hasClass("tencent")){
                    url = qt_share(content,img_url,location.origin,append_share_source);
                }else if($(this).hasClass("qqim")){
                    url = qqim_share(content,img_url,location.origin,(_translate("share_share_from") || "分享自")+":"+(_translate("app_name") || "Ok记"),document.title,append_share_source);
                }else if($(this).hasClass("gmail")){
                    url = gmail_share(content);
                }else if($(this).hasClass("twitter")){
                    url = twitter_share(content,share_url,"okmemo",extra);
                }else if($(this).hasClass("facebook")){
                    url = fb_share(content,share_url,extra);
                }else if($(this).hasClass("plus")){
                    url = gplus_share(share_url,extra);
                }
                //发送给QQ好友或群组
                //http://connect.qq.com/widget/shareqq/index.html?url=http%3A%2F%2Fwww.smallactions.cn&showcount=0&desc=%E5%B0%8F%E8%A1%8C%E5%8A%A8%E5%A4%A7%E4%B8%8D%E5%90%8C%E6%98%AF%E7%88%B6%E6%AF%8D%EF%BC%9F%E6%98%AF%E5%AD%A9%E5%AD%90%EF%BC%9F%E6%98%AF%E7%88%B1%E4%BA%BA%E8%BF%98%E6%98%AF%E4%BC%99%E4%BC%B4%EF%BC%9F%E8%B0%81%E6%98%AF%E4%BD%A0%E4%B8%80%E7%94%9F%E4%B8%AD%E6%9C%80%E6%83%B3%E5%AE%88%E6%8A%A4%E7%9A%84%E4%BA%BA%EF%BC%9F%E5%8A%A0%E5%85%A5%E8%81%94%E5%90%88%E5%88%A9%E5%8D%8E%5B%E5%B0%8F%E8%A1%8C%E5%8A%A8+%E5%A4%A7%E4%B8%8D%E5%90%8C%5D%EF%BC%8C%E4%BB%A5%E6%AF%8F%E4%B8%80%E4%B8%AA%E5%B0%8F%E5%B0%8F%E8%A1%8C%E5%8A%A8%EF%BC%8C%E4%B8%BA%E4%BA%86%E6%88%91%E4%BB%AC%E6%83%B3%E8%A6%81%E5%AE%88%E6%8A%A4%E7%9A%84%E4%BA%BA%EF%BC%8C%E5%88%9B%E9%80%A0%E7%BE%8E%E5%A5%BD%E6%9C%AA%E6%9D%A5%E5%A4%A7%E4%B8%8D%E5%90%8C%EF%BC%81&summary=%E5%B0%8F%E8%A1%8C%E5%8A%A8%E5%A4%A7%E4%B8%8D%E5%90%8C%E6%98%AF%E7%88%B6%E6%AF%8D%EF%BC%9F%E6%98%AF%E5%AD%A9%E5%AD%90%EF%BC%9F%E6%98%AF%E7%88%B1%E4%BA%BA%E8%BF%98%E6%98%AF%E4%BC%99%E4%BC%B4%EF%BC%9F%E8%B0%81%E6%98%AF%E4%BD%A0%E4%B8%80%E7%94%9F%E4%B8%AD%E6%9C%80%E6%83%B3%E5%AE%88%E6%8A%A4%E7%9A%84%E4%BA%BA%EF%BC%9F%E5%8A%A0%E5%85%A5%E8%81%94%E5%90%88%E5%88%A9%E5%8D%8E%5B%E5%B0%8F%E8%A1%8C%E5%8A%A8+%E5%A4%A7%E4%B8%8D%E5%90%8C%5D%EF%BC%8C%E4%BB%A5%E6%AF%8F%E4%B8%80%E4%B8%AA%E5%B0%8F%E5%B0%8F%E8%A1%8C%E5%8A%A8%EF%BC%8C%E4%B8%BA%E4%BA%86%E6%88%91%E4%BB%AC%E6%83%B3%E8%A6%81%E5%AE%88%E6%8A%A4%E7%9A%84%E4%BA%BA%EF%BC%8C%E5%88%9B%E9%80%A0%E7%BE%8E%E5%A5%BD%E6%9C%AA%E6%9D%A5%E5%A4%A7%E4%B8%8D%E5%90%8C%EF%BC%81&title=%E5%B0%8F%E8%A1%8C%E5%8A%A8%E5%A4%A7%E4%B8%8D%E5%90%8C&site=jiathis&pics=http%3A%2F%2Fwww.smallactions.cn%2Fdocroot%2Fimg%2Fheader%2Flogo.jpg
                if(!$(this).hasClass("wechat")){
                    var share_win = window.open(url,'','height='+newwin_height+',width='+newwin_width+',top='+newwin_top+',left='+newwin_left+',toolbar=no,menubar=no,scrollbars=yes,resizable=no,location=no,status=no');
                }else{
                    //生成一个二维码
                    var tmpDiv = $("<div>",{style:"text-align:center;"}).qrcode({
                        size: 150,
                        color: '#3a3',
                        text: "\n\n\n\n\n"+utf16to8(content)+"\n\n\n\n\n\n"
                    });

                    popup_dialog({
                        title: _translate("scan_to_share_text"),
                        desc: tmpDiv,
                        classstr: "wechat",
                        callback: function(){
                            close_popup();
                        }
                    });
                }
            });

            
            //给拥有默认标签的便签加上带颜色的假边框
            highlight_colored_tags();

            //自定义便签标签部分
            // $("#wrapper").on("click touchstart","#note_ops .default a.dropdown",function(event){
            //     event = EventUtil.getEvent(event);
            //     EventUtil.preventDefault(event);

            //     //展开内容
            //     if(!$("#note_ops").hasClass("adding-custom")){
            //         //内容没有被展开，则展开
            //         $("#note_ops").addClass("adding-custom");
            //     }else{
            //         $("#note_ops").removeClass("adding-custom");
            //     }
            // });

            // $("#wrapper").on("click touchstart",".custom a.tag",function(event){
            //     var event = EventUtil.getEvent(event);
            //         EventUtil.preventDefault(event);

            //     var that = this;
            //     var $note = $(this).parentsUntil(".note-con").last().parent();
            //     var note_id = $note.data("id");
            //     var tag_id = $(this).data("id");
            //     var note = new Note({id:note_id});
            //     if(note_id > 0 && tag_id > 0){
            //         if($(this).hasClass("choosed")){
            //             note.removeTag(tag_id,function(data){
            //                 if(console) console.log(data);
            //                 var feedback = get_json_feedback(data);
            //                 if(feedback.status == "ok"){
            //                     //移除标签成功
            //                     $(that).removeClass("choosed")
            //                 }else{
            //                     //移除标签失败
            //                     showMessage({type:"error",msg:"移除标签失败"});
            //                 }
            //             });
            //         }else{
            //             note.addTag(tag_id,function(data){
            //                 var feedback = get_json_feedback(data);
            //                 if(feedback.status && feedback.status == "ok"){
            //                     $(that).addClass("choosed");
            //                 }
            //             });
            //         }
            //     }
            // });

            // $(".tags.section .add-tag").on("click "+downEvent,function(event){
            //     event = EventUtil.getEvent(event);
            //     var target = EventUtil.getTarget(event);
            //     if(target.type && target.type == "submit"){
            //         return false;
            //     }
            //     $("input.tag-name",this).focus();
            // });

            $(".tags.section a.new-btn").on("click "+downEvent,function(event){
                event = EventUtil.getEvent(event);
                EventUtil.preventDefault(event);

                //如果已经达到了tag数量上限
                var current_tags_num = $("#search_area a.tag").not(".default").length;
                if(current_tags_num >= APP.max_tag_num){
                    showMessage({type:"warning",msg:"对不起，你的标签数量已经达到上限",autoclose:true});
                    return false;
                }

                $(".tags.section").addClass("adding-tag");
                console.log("add");
                $("div.new-tag-con input.tag-name").focus().blur(function(event){
                    if(this.value == ""){
                        $(".tags.section").removeClass("adding-tag");
                    }
                });
            });

            //点击图片下载，如果用户没有装插件则要求其装上插件
            $(".tag-result").on("click","a.img-downloader",function(event){
                if(!$("body").hasClass("extension")){
                    //要求安装插件
                    setTimeout(function(){
                        APP.show_install_btn();
                    },1500);
                    Tracker.sendEvent('Note Operations','download img','no extension');
                    //阻止下载
                    event.preventDefault();
                }else{
                    Tracker.sendEvent('Note Operations','download img');

                    if($("body").hasClass("no-attr-dl") && !$("body").hasClass("firefox")){
                        Tracker.sendEvent('Note Operations','unable to download img');
                        var $img = $(this).parent().find(".lb img");
                        var newwin_height = $img && $img.data("height") ? $img.data("height") : 500,
                            newwin_width = $img && $img.data("width") ? $img.data("width") : 800,
                            newwin_top = (window.screen.height - newwin_height) / 2,
                            newwin_left = (window.screen.width - newwin_width) / 2;

                        window.open(this.href+"?__sharesource=okmemo",'','height='+newwin_height+',width='+newwin_width+',top='+newwin_top+',left='+newwin_left+',toolbar=no,menubar=no,scrollbars=yes,resizable=no,location=no,status=no');
                        event.preventDefault();
                    }
                }
            });

            $("#search_area .by-tag a.new-btn").on("click "+downEvent,function(event){
                event = EventUtil.getEvent(event);
                EventUtil.preventDefault(event);
                //如果已经达到了tag数量上限
                var current_tags_num = $("#search_area a.tag").not(".default").length;
                if(current_tags_num >= APP.max_tag_num){
                    showMessage({type:"warning",msg:"对不起，你的标签数量已经达到上限",autoclose:true});
                    return false;
                }

                $("#search_area .by-tag").addClass("adding-tag");
                
                $("div.new-tag-con input.tag-name").focus().blur(function(event){
                    if(this.value == ""){
                        $("#search_area .by-tag").removeClass("adding-tag");
                    }
                });
            });


            /*添加新标签*/
            $(".tags.section,#search_area .by-tag").on("focus",".newtag-con input",function(event){
                $(this).parent().addClass("creating");
                if(this.value == "+") this.value = "";
            }).on("blur keydown",".newtag-con input",function(event){
                if(event.type == "focusout" || (event.type == "keydown" && event.keyCode == 13)){
                    Tracker.sendEvent('Tag Operations',"create:"+event.type);
                    //保存标签
                    var that =this;
                    //检测名字的合法性
                    if($.trim(this.value) == "" || this.value == "+"){
                        $(this).parent().removeClass("creating");
                        this.value = "+";
                        return false;
                    }

                    if(this.value.length > 16){
                        showMessage({type:"error",msg:_translate("error_tag_too_long") || "标签名不可超过16个字符",autoclose:true});
                        return false;
                    }

                    var duplicate = false;
                    var $duplicate_tag = null;

                    $("#search_area .tag-con .tag-name").each(function(){
                        if($.trim($(this).text()) == $.trim(that.value)){
                            $duplicate_tag = $(this).closest(".tag-con");
                            duplicate = true;
                        }
                    });

                    if(duplicate){
                        $duplicate_tag.addClass("warning");
                        showMessage({type:"error",msg:_translate("error_tag_conflict") || "有重名标签存在",autoclose:true});
                        return false;
                    }

                    var tag = new Tag({name:this.value});

                    tag.create(function(feedback){
                        console.log(feedback);

                        if(feedback.status == "ok"){
                            //创建成功
                            $("#search_area .custom-tags .tags-con .tag-con").last().after("<div data-position=\""+feedback.position+"\" class=\"tag-con\"><a href=\"#\"  data-id=\""+feedback.tagid+"\" draggable=\"false\" class=\"tag\">"+
                                                                                        "<span class=\"tag-name\">"+that.value+"</span><span class=\"del-tag\"><span class=\"ok-icon-closeSmall\"></span></span>"+
                                                                                        "</a></div>");
                            $(that).parent().removeClass("creating");

                            var new_class = "newly-added-"+Date.now();

                            //更新底部菜单
                            $("#note_ops .tags.section a.tag").last().after("<a href=\"#\" class=\"tag "+new_class+"\" data-id=\""+feedback.tagid+"\"><span class=\"tag-name\">"+that.value+"</span></a>");
                            that.value = "+";

                            //如果是在底部菜单处添加则也给笔记添加此标签
                            var $note_con = $(that).closest(".note-con");
                            
                            if($note_con.length > 0){
                                var note_id = $note_con.data("id");
                                if(note_id > 0){
                                    var note = new Note({id:note_id});
                                    //添加标签
                                    note.addTag(feedback.tagid,function(response){
                                        console.log(response);
                                        if(response.status == "ok"){
                                            //更新本地数据
                                            idl.LM.updateNote({
                                                type: "tag",
                                                value: "+"+feedback.tagid,
                                                id: note.id,
                                            });

                                            $("."+new_class).addClass("choosed");

                                            //如果用户为安装浏览器扩展，则提醒他安装
                                            if(!$("body").hasClass("extension")){
                                                setTimeout(function(){
                                                    APP.show_install_btn();
                                                },1500);
                                            }
                                        }else{
                                            showMessage({type:"error",msg:_translate("error_failed_add_tag") || "添加标签失败",autoclose:true});
                                        }
                                    });
                                }
                            }
                        }else{
                            var msg = _translate("error_failed_add_tag") || "添加标签失败";
                            if(feedback.error){
                                switch(feedback.error){
                                    case "duplicate":
                                        msg = _translate("error_tag_conflict") || "标签名称已经存在";
                                        break;
                                    case "invalid parameter":
                                        msg = _translate("error_invalid_parameters") || "标签名不能包含特殊符号";
                                        break;
                                };
                            }
                            showMessage({type:"error",msg:msg});
                        }
                    });
                } 
            });

            //当用户在输入时自动扩大字段长度
            $(".tags.section,#search_area .by-tag").on("keyup input paste",".newtag-con input",function(event){
                if(this.value.length > 3){
                    if(this.value.length < 30) $(this).attr("size",this.value.length);
                }else{
                    $(this).attr("size",3);
                }
            });

            //给便签添加一个新的标签
            function add_new_tag(tag_name,input,from){
                if($.trim(tag_name) == ""){
                    return false;
                }

                //先创建tag
                var tag_obj = new Tag({name:tag_name});
                
                tag_obj.save(function(data){
                    if(console) console.log(data);
                    var feedback = data;
                    if(feedback.status && feedback.status == "ok"){
                        input.value = "";
                        $(input).focus();
                        $(input).attr("size",3);

                        if(feedback.tagid && feedback.tagid > 0){
                            var tag_id = feedback.tagid;

                            //如果用户为安装浏览器扩展，则提醒他安装
                            if(!$("body").hasClass("extension")){
                                setTimeout(function(){
                                    APP.show_install_btn();
                                },1500);
                            }

                            //更新所有tag列表
                            $(".tags .custom a.tag").last().after("<a href=\"#\" class=\"tag\" data-id=\""+tag_id+"\">"+tag_obj.name+"</a>");
                            $("#search_area .by-tag .custom-tags div.tag-con").last().after("<div class=\"tag-con\"><a href=\"#\" draggable=\"false\" class=\"tag\" data-id=\""+tag_id+"\">"+tag_name+"</a></div>");
                            
                            //如果在搜索栏添加，则只创建标签不给便签添加
                            if(!from || (from && from != "search_area")){
                                var $note = $(input).closest(".note-con");
                                var note_id = $note.data("id");
                                var note = new Note({id:note_id});
                                console.log(note);
                                //再添加tag
                                note.addTag(tag_id,function(feedback){
                                    if(feedback.status == "ok"){
                                        //加标签成功
                                        $(".tags.section .tag[data-id=\""+tag_id+"\"]").addClass("choosed");
                                    }else{
                                        //加标签失败
                                        showMessage({type:"error",msg:_translate("error_failed_add_tag") || "加标签失败",autoclose:true});
                                    }
                                });
                            }
                        }
                    }else{
                        showMessage({type:"error",msg:_translate("error_failed_add_tag") ||"加标签失败",autoclose:true});
                    }
                });
            }

            //同步至ical,google calendar
            $("#wrapper").on("click "+downEvent,"#sync a.sync-to",function(event){
                event = EventUtil.getEvent(event);
                EventUtil.preventDefault(event);
                //同步完成的提示信息
                var callback = function(data){
                    var feedback = get_json_feedback(data);
                    if(feedback.status == "ok"){

                    }else{
                        if(feedback.msg){
                            showMessage({type:"error",msg:feedback.msg});
                        }
                    }
                };

                if($(this).hasClass("gcal")){
                    Note.prototype.sync("gcal",callback);
                }else if($(this).hasClass("evernote")){
                    Note.prototype.sync("evernote",callback);
                }else if($(this).hasClass("weibo")){
                    Note.prototype.sync("weibo",callback);
                }else if($(this).hasClass("ical")){
                    Note.prototype.sync("ical",callback);
                }
            });

            //添加或者移除标签，同时需要更新修改时间
            $("#search_results").on("click "+downEvent,"#note_ops .tags a.tag",function(event){
                event = EventUtil.getEvent(event);
                EventUtil.preventDefault(event);

                var $note = $(".note-con.adding-tags");
                var id = $note.data("id");
                var tag_id = $(this).data("id");
                var tag_name = $(this).text();
                var that = this;

                if($(this).hasClass("choosed")){
                    Tracker.sendEvent('Note Operations','remove tag');
                    //移除选中的标签
                    if(id && id > 0 && tag_id && tag_id > 0){
                        var note = new Note({id:id});

                        //若需要删除的标签是当前打开的标签，则在删除之后需要将其隐藏，所以要给出撤销操作
                        if(tag_id == $("#search_area .by-tag .tag.active").data("id")){
                            $note.addClass("to-be-moved" ,function(){
                                //提示可撤销操作
                                //$note.before("<div class=\"feedback-hint\">"+(_translate("msg_removed_from_tag") || "该便签已被移出\""+tag_name+"\"标签")+"<a href=\"#\" data-event=\"move\" id=\"revocate\">"+_translate("btn_revoke") || "撤销"+"</a></div>");
                                //若需要删除的标签是当前打开的标签，则在删除之后需要将其隐藏，所以要给出撤销操作
                                var moveView = 
                                '<div class="rec-m-wrapper">'
                                    +'<div class="rec-m-box">'
                                        +'<span class="ok-icon-tages icon-font rec-m-icon"></span>'
                                        +'<span class="rec-m-text">正在移除标签...</span>'
                                        +'<span class="rec-m-line">|</span>'
                                        +'<a href="#" class="rec-m-revocate" data-event=\"move\" data-id=\"'+ note.id +'\" id=\"revocate\">撤销</a>'
                                    +'</div>'
                                    +'<div class="rec-m-progress-box">'
                                        +'<div class="rec-m-progress-all"></div>'
                                        +'<div class="rec-m-progress-run"></div>'
                                    +'</div>'
                                +'</div>';

                                $note.append(moveView);
                                var move_note_timeout = setTimeout(function(){
                                    if($note.hasClass("to-be-moved")){
                                        //删除便签
                                        note.removeTag(tag_id,function(data){
                                            if(console) console.log(data);
                                            var feedback = get_json_feedback(data);
                                            if(feedback.status == "ok"){
                                                //更新本地数据
                                                idl.LM.updateNote({
                                                    type: "tag",
                                                    value: "-"+tag_id,
                                                    id: note.id,
                                                });

                                                //如果移出的标签为当前打开的标签，则更新计数
                                                recount_in_tag("delete");
                                                //在删除前，将底部菜单保留
                                                $note.find("#note_ops").appendTo("body");

                                                //隐藏提示
                                                $(".feedback-hint").fadeOut("fast",function(){$(this).remove();});

                                                //如果移除的是任务标签
                                                if(that.id == "tag_tasks"){
                                                    note.task_id = $note.data("task-id");
                                                    $note.removeClass("task");

                                                    NotificationCenter.remove({id:note.id});
                                                    
                                                    //去掉任务属性，删除任务
                                                    note.unsetTask(function(data){
                                                        var feedback = get_json_feedback(data);
                                                        if(feedback.status == "ok"){

                                                        }else{
                                                            
                                                        }
                                                    });
                                                }

                                                $note.remove();
                                            }else{
                                                //移除标签失败
                                                showMessage({type:"error",msg:_translate("error_failed_remove_tag") || "移除标签失败"});
                                                //还原
                                                $note.removeClass("to-be-moved").fadeIn();
                                                $("feedback-hint").remove();
                                            }
                                        });
                                    }else{
                                        clearTimeout(move_note_timeout);
                                    }
                                },3000);
                                // hugo added
                                $('#revocate[data-id="' + note.id + '"]').data('retagId',move_note_timeout);
                            });
                        }else{
                            //移除一个标签
                            note.removeTag(tag_id,function(feedback){
                                if(feedback.status == "ok"){
                                    //更新本地数据
                                    idl.LM.updateNote({
                                        type: "tag",
                                        value: "-"+tag_id,
                                        id: note.id,
                                    });

                                    //如果移除的是任务标签
                                    if(that.id == "tag_tasks"){
                                        note.task_id = $note.data("task-id");
                                        $note.removeClass("task");

                                        NotificationCenter.remove({id:note.id});

                                        //如果移除的是任务标签
                                        //去掉任务属性，删除任务
                                        note.unsetTask(function(data){
                                            var feedback = get_json_feedback(data);
                                            if(feedback.status == "ok"){

                                            }else{
                                                
                                            }
                                        });
                                    }

                                    //移除标签成功
                                    $(that).removeClass("choosed");

                                    if($(that).hasClass("colored-tag")){
                                        //如果是含有颜色的标签，则删除便签上对应的颜色块
                                        $note.find(".strips div.default_tag[data-id=\""+tag_id+"\"]").remove();
                                        highlight_colored_tags($note.removeClass("highlighted").get(0));

                                        //移除反色
                                        $(that).css({background:"white",color:$(that).data("color")});
                                    }
                                }else{
                                    //移除标签失败
                                    showMessage({type:"error",msg:_translate("error_failed_remove_tag") || "移除标签失败",autoclose:true});
                                }
                            });
                        }
                    }
                }else{
                    Tracker.sendEvent('Note Operations','add tag');
                    //添加新的标签
                    if(id && id > 0 && tag_id && tag_id > 0){
                        var note = new Note({id:id});

                        note.addTag(tag_id,function(feedback){
                            if(feedback.status == "ok"){
                                //如果用户为安装浏览器扩展，则提醒他安装
                                if(!$("body").hasClass("extension")){
                                    setTimeout(function(){
                                        APP.show_install_btn();
                                    },1500);
                                }

                                //如果添加的是任务标签
                                if(that.id == "tag_tasks"){
                                    $note.addClass("task");
                                    note.deadline = null;
                                    note.setTask(function(feedback){
                                        if(feedback.status == "ok"){
                                            idl.LM.updateNote({
                                                type: "task",
                                                value: "create",
                                                id: note.id,
                                                task_id: feedback.task_id,
                                                position: feedback.position
                                            });

                                            //无截止日期任务添加成功
                                            //应当返回任务id，以及position
                                            if(console) console.log("新的无截止日期的任务创建成功");
                                            $note.attr({"data-task-id":feedback.task_id,"data-position":feedback.position}).data({"position":feedback.position,"task-id":feedback.task_id});
                                        }
                                    });
                                }

                                //加标签成功
                                $(that).addClass("choosed");

                                if($(that).hasClass("colored-tag")){
                                    //如果是含有颜色的标签，则为便签添加颜色
                                    var color = $(that).data("color"),$form = $note.find("form");

                                    //如果是链接标签则prepend，若是联系人标签则append
                                    if(that.id == "tag_contacts"){
                                        $note.find('.strips').append("<div class=\"default_tag\" data-id=\""+tag_id+"\" style=\"background:"+color+"\"></div>");
                                    }else if(that.id == "tag_links"){
                                        $note.find('.strips').prepend("<div class=\"default_tag\" data-id=\""+tag_id+"\" style=\"background:"+color+"\"></div>");
                                    }
                                    
                                    highlight_colored_tags($note.removeClass("highlighted").get(0));

                                    //添加反色
                                    $(that).css({background:color,color:"white"});
                                }
                            }else{
                                //加标签失败
                                showMessage({type:"error",msg:_translate("error_failed_add_tag") || "加标签失败",autoclose:true});
                            }
                        });
                    }
                }
            }); 

            //点击记事本旁的选项框时将记事/任务标记为完成与未完成 (选项框为div而非input checkbox)
            toggleClick(".note-con .checkbox","checked",true,function(){
                Tracker.sendEvent('Note Operations','recover task');
                var $note_con = $(this).closest(".note-con");
                var note_id = $note_con.data("id");
                var deadline = $note_con.data("deadline");
                var task_id = $note_con.data("task-id");
                if(!!!note_id) return false;
                var in_task_panel = $("#search_results").hasClass("results-of-tasks");
                var note = new Note({id:note_id,deadline:deadline,task_id:task_id});
                
                //如果实在任务面板则给出动画,提前给出反馈
                if(in_task_panel){
                    var $clone = $note_con.clone();
                    $note_con.hide().before($clone.addClass("recovering"));
                }

                //重新将已完成的任务标记为未完成
                note.recover(function(feedback){
                    if(feedback.status == "ok"){
                        //更新本地数据
                        idl.LM.updateNote({
                            type: "recover",
                            id: note_id
                        });

                        $note_con.find("form").removeClass("finished");
                        $note_con.find("div.deadline").remove();
                        if($note_con.hasClass("today")){
                            recount_today_tasks("recover");
                        }

                        //如果是在任务列表面板中，则将其移到最前方
                        if(in_task_panel){
                            // $note_con.fadeOut("slow",function(){
                            //     //移动到以后列表中的第一个
                            //     $("#search_results .by-tag.result .tag-result.show").find("h1.later-area").after(this);
                            // }).delay(500).fadeIn().addClass("outline").removeClass("hidden");

                            $note_con.each(function(){
                                //移动到以后列表中的第一个
                                $("#search_results .by-tag.result .tag-result.show").find("h1.later-area").after(this);
                            }).fadeIn().addClass("outline").removeClass("hidden");

                            setTimeout(function(){
                                $(".outline").removeClass("outline");
                                $clone.remove();
                                $clone = null;
                            },3000);
                        }

                        var $note = $note_con.find(content_area);

                        if($note.length > 0){
                            configure_height($note.get(0));
                        }
                    }else{
                        showMessage({type:"error",msg:_translate("error_operation_failed") || "操作失败",autoclose:true});
                        $note_con.addClass("recovering-error");
                    }
                });
                note = null;
            },function(){
                Tracker.sendEvent('Note Operations','finish task')
                //选中之后，将任务或记事标记为已完成
                var $note_con = $(this).closest(".note-con");
                var note_id = $note_con.data("id");
                var deadline = $note_con.data("deadline");
                var task_id = $note_con.data("task-id");
                if(!!!note_id) return false;

                var in_task_panel = $("#search_results").hasClass("results-of-tasks");
                
                if(in_task_panel){
                    var $clone = $note_con.clone();
                    $note_con.hide().before($clone.addClass("finishing"));
                }

                var note = new Note({id:note_id,deadline:deadline,task_id:task_id});

                NotificationCenter.remove({id:note.id});

                note.finish(function(feedback){
                    if(feedback.status == "ok"){
                        //更新本地数据
                        idl.LM.updateNote({
                            type: "finish",
                            id: note_id
                        });

                        //如果是今天的任务，则首先将今日任务计数减一，然后检查今日任务是否为0，如果为0，则隐藏今日任务区域
                        if($note_con.hasClass("today")){
                            recount_today_tasks("finished");
                        }

                        //如果是在任务列表面板中，则将其移到最后方
                        if(in_task_panel){

                            $note_con.each(function(){
                                //移到已完成任务的最前方
                                var $finished_items = $("#search_results .by-tag.result .note-con form.finished");
                                $(this).find("form").addClass("finished");

                                if($finished_items.length > 0){
                                    //如果存在已经完成的便签
                                    $finished_items.first().closest(".note-con").before(this);
                                    $note_con.fadeIn().addClass("outline").addClass("hidden").find("form").addClass("finished");
                                }else{
                                    //如果不存在已完成的便签且所有任务已经加载完成，则放到最后面
                                    if($("#tag_tasks").hasClass("finished")){
                                        $note_con.fadeIn().addClass("outline").appendTo("#search_results .by-tag.result .tag-result.show");
                                    }else{
                                        $note_con.remove();
                                        $note_con = null;
                                    }   
                                }
                            });

                            setTimeout(function(){
                                $(".outline").removeClass("outline");
                                $clone.remove();
                                $clone = null;
                            },3000);
                        }
                        
                        $note_con.find("form").addClass("finished");

                        if($note_con){
                        var $note = $note_con.find(content_area);
                            if($note.length > 0){
                                configure_height($note.get(0));
                            }
                        }
                    }else{
                        $note_con.addClass("finishing-error")
                        showMessage({type:"error",msg:_translate("error_operation_failed") || "操作失败",autoclose:true});
                    }
                });
                note = null;
            });
            
            //滚动加载记事(加载当前面板所属标签下的便签)
            $(window).on("scroll.window",container_onscroll);

            $("body #wrapper").on("scroll",container_onscroll);

            function container_onscroll(event){
                event = EventUtil.getEvent(event);
                var target = EventUtil.getTarget(event);

                var $body = $("body");
                $body.removeClass("hover");
                if(idl.hoverTimer) clearTimeout(idl.hoverTimer);
                idl.hoverTimer = setTimeout(function(){
                    $body.addClass("hover");
                },800);

                if(target == document && ( $body.hasClass("single-mode") || $body.hasClass("ok-lightbox-on") || $body.hasClass("img-wall")||$body.hasClass("open-link")||$body.hasClass("configuring") )){
                    //若是在侧栏模式中滚动整个窗口则不做操作
                    return false;
                }

                if(target.id && target.id == "wrapper" && !( $body.hasClass("single-mode")|| $body.hasClass("ok-lightbox-on") ||$body.hasClass("img-wall")||$body.hasClass("open-link")||$body.hasClass("configuring") ) ){
                    //若是在非侧栏模式中滚动整个窗口则不做操作
                    return false;
                }

                if(target == document){
                    var con_full_height = $(target).height();
                }

                if(target.id && target.id == "wrapper"){
                    var con_full_height = $(target).prop("scrollHeight");
                }

                var that = $("#note").get(0);
                var $cur_tag = $("#search_area .by-tag a.tag.active");

                if(stickyTop == 0){
                    stickyTop = $('#search_area').offset().top;
                }

                //滚动到一定位置，保留搜索栏
                if($(target).scrollTop() >= stickyTop ){
                    stickyWidth = $('#search_area').width();
                    //添加fixed类，隐藏下部标签
                    if(!$("#search_area").hasClass("fixed")){
                        $("#search_area").addClass("fixed").css({width:stickyWidth+"px"});
                    }

                    $("#backtotop").addClass("show");
                }else{
                    if($("#search_area").hasClass("fixed")){
                        $("#search_area").removeClass("fixed").removeAttr("style");
                    }

                    $("#backtotop").removeClass("show");
                }
                
                return ;
                //当滚动到离页面底部还有500px时，加载内容
                // if($(target).scrollTop() > con_full_height - $(window).height() - 500) {
                //     if($(that).hasClass("loading") || $(that).hasClass("end") || $(this).hasClass("empty") || !$("body").hasClass("note-app")){
                //         //页面正在加载，不继续请求
                //         return false;
                //     }

                //     $(that).addClass("loading");
                //     var tag_id = $cur_tag.data("id"),
                //         limit = 10,
                //         offset_id = $("#search_results .by-tag .tag-result.show .note-con").last().data("id") ? $("#search_results .by-tag .tag-result.show .note-con").last().data("id") : 0;
                    
                //     if($cur_tag.hasClass("finished")){
                //         if(console) console.log("marked as finished");
                //         $(that).removeClass("loading");
                //         return false;
                //     }

                //     if(console) console.log(offset_id);
                //     //如果当前打开的面板是任务面板，且便签中存在已完成的便签，则说明未完成的便签已经取完
                //     Note.prototype.get_notes_in_tag(tag_id,limit,offset_id,function(data){
                //         var feedback = get_json_feedback(data),noteobj,note,notes;
                //         var note_html = "";

                //         if($("#search_results .by-tag .tag-result.tag-"+tag_id).length == 0){
                //             $("#search_results .by-tag").append("<div class=\"tag-result tag-"+tag_id+"\"></div>");
                //         }

                //         var tag_notes_con = $("#search_results .by-tag .tag-result.tag-"+tag_id).fadeIn(function(){$(this).addClass("show")}).get(0);

                //         if(feedback.notes && feedback.notes.length > 0){
                //             notes = feedback.notes;
                            
                //             //放入全局变量中缓存标签数据
                //             // if(!idl.apps.note.tag["tag_"+tag_id]){
                //             //     idl.apps.note.tag["tag_"+tag_id] = {};
                //             // }

                //             // if(!idl.apps.note.tag["tag_"+tag_id].notes){
                //             //     idl.apps.note.tag["tag_"+tag_id].notes = [];
                //             // }
                //             // var ori_tag_notes = idl.apps.note.tag["tag_"+tag_id].notes;
                //             // idl.apps.note.tag["tag_"+tag_id].notes = ori_tag_notes.concat(notes);


                //             for(var i=0,len=notes.length; i<len; i++){
                //                 noteobj = notes[i];
                //                 note = new Note(noteobj);
                //                 note.construct_item("newly_loaded");
                //                 note_html += note.html;
                //             }
                        
                //             $(tag_notes_con).append(note_html);

                //             $(".note-con.newly_loaded",tag_notes_con).each(function(){
                //                 var $note = $(this).find(content_area);
                //                 if($note.length > 0){
                //                     $note.data("value",$note.html());
                //                     var content = decode_content($note.html());
                //                     $note.html(content);
                //                     configure_height($note.get(0));
                //                 }
                //                 $(this).removeClass("newly_loaded");
                //             });
                //             highlight_colored_tags();
                //             $(that).removeClass("loading");
                //         }else{
                //             if(console) console.log("end");
                //             //结果返回空则是加载结束
                //             if(tag_id == $("#tag_tasks").data("id")){
                //                 //如果是任务标签，返回空则表示未完成的任务已经加载完成，已经完成的是否加载完成还是未知数需要作判断
                //                 //如果未完成的任务便签刚好50条，则不会提供取已完成的便签的参考offset_id
                //                 //则继续加载已完成的便签

                //                 if(!$(".note-con",tag_notes_con).last().find("form").hasClass("finished")){
                //                     if(console) console.log("no finished, load from start of finished notes");
                //                     //如果现在存在的便签中不存在已完成的便签，则从已完成的便签中从头开始加载
                //                     offset_id = 0;
                //                 }else{
                //                     if(console) console.log("has finished, load from "+offset_id);
                //                 }

                //                 Note.prototype.load_finished(limit,offset_id,function(data){
                //                     console.log(data);
                //                     var feedback = get_json_feedback(data),noteobj,note,notes;
                //                     var note_html = "";
                //                     if(feedback.notes && feedback.notes.length > 0){
                //                         notes = feedback.notes;

                //                         for(var i=0,len=notes.length; i<len; i++){
                //                             noteobj = notes[i];
                                            
                //                             note = new Note(noteobj);
                //                             note.construct_item("newly_loaded");
                //                             note_html += note.html;
                //                         }

                //                         $(tag_notes_con).append(note_html);
                //                         $(".note-con.newly_loaded",tag_notes_con).each(function(){
                //                             var $note = $(this).find(content_area);
                //                             if($note.length > 0){
                //                                 $note.data("value",$note.html());
                //                                 var content = decode_content($note.html());
                //                                 $note.html(content);
                //                                 configure_height($note.get(0));
                //                             }
                //                             load_image_entity($note.get(0));
                //                             $(this).removeClass("newly_loaded");
                //                         });

                //                         var results_length = $(".note-con",tag_notes_con).length;
                                        
                //                         highlight_colored_tags();
                //                         $(that).removeClass("loading");
                //                     }else{
                //                         //给出搜索完成标识
                //                         $("#search_area #tag_tasks").addClass("finished");
                //                         $(that).removeClass("loading");
                //                         return false;
                //                     }
                //                 });
                //             }else{
                //                 //给出搜索完成标识
                //                 $cur_tag.addClass("finished");
                //                 $(that).removeClass("loading");
                //                 $(".note-con.newly_loaded",tag_notes_con).each(function(){
                //                     var $note = $(this).find(content_area);
                //                     if($note.length > 0){
                //                         $note.data("value",$note.html());
                //                         var content = decode_content($note.html());
                //                         $note.html(content);
                //                         configure_height($note.get(0));
                //                         load_image_entity($note.get(0));
                //                     }
                //                     $(this).removeClass("newly_loaded");
                //                 });
                                
                //                 highlight_colored_tags();
                //                 return false;
                //             }
                //         }
                //     });
                // }
            }

            $("#note #backtotop").on("click "+downEvent,function(event){
                event = EventUtil.getEvent(event);
                EventUtil.preventDefault(event);

                $("html,body").animate({scrollTop: 0},"fast");
                $('#search_area').css({position:'relative',width:stickyWidth}).removeClass("fixed");
                Tracker.sendEvent('Common UI','back to top')
            });

            //将已经修改的内容标记为已修改
            $("#wrapper").on("keyup",".note-con",function(event){
                var editable = $(this).find(".note.editable").get(0);
                var cursorPos = getCursorPosition(editable);
                var note_con = this;
                var note = new Note({id:$(this).data("id")});
                //在移动设备上delete键不会被检测到
                //所以如果删除了某些文字并不会标识为已修改
                //只有按下了字符键(包括空格，回车)才回标识为已修改
                if($(content_area,this).html() != $(content_area,this).data("value") && $(this).hasClass("editing")){
                    $(this).addClass("modified").removeClass("saved");
                }else{
                    $(this).removeClass("modified");
                }

                //此处针对移动设备
                //装了其他输入法的设备可以检测到键盘事件，但无法检测到事件的keycode 或 which属性
                //alert(event.which);
                if(!event.keyCode && !event.which){
                    //如果位置为1，则记录下0-1这个位置输入的字符，若字符==" "，则相当于按下了space键
                    var char = getLastInput(editable);

                    //如果敲下的为空格
                    if(/\s/.test(char)){
                        if(cursorPos == 1){
                            //在打头处敲下空格键，记录下来，为下次敲击做准备
                            $(this).data({"hit_space_count":1,"hit_space_time":Date.now()});
                        }else if(cursorPos == 2){
                            Tracker.sendEvent('Note Operations','two space task|mobile');
                            if($(this).data("hit_space_count") == 1){
                                var hit_space_time = $(this).data("hit_space_time");

                                //两次空格键按下的时间必须超过一定值才添加任务
                                if(Date.now() - hit_space_time > 500){
                                    return ;
                                }

                                //如果不是新的便签，则为其添加上任务标签
                                if(!$(this).hasClass("new")){
                                    note.addTag($("#tag_tasks").data("id"),function(feedback){
                                        if(feedback.status == "ok"){
                                            note.deadline = null;
                                            note.setTask(function(data){
                                                feedback = get_json_feedback(data);
                                                if(feedback.status == "ok"){
                                                    $(note_con).addClass("task");
                                                    $(note_con).attr({"data-task-id":feedback.task_id,"data-position":feedback.position}).data({"position":feedback.position,"task-id":feedback.task_id});
                                                    //如果添加的当前的标签有色彩值，则需要为新建的便签加上色彩值
                                                    var color = $("#tag_tasks").data("color");
                                                    
                                                    if(!!color){
                                                        $("form",that).append("<div class=\"default_tag\" data-id=\""+task_id+"\" style=\"background:"+color+"\"></div>");
                                                    }

                                                    if($(note_con).hasClass("highlighted")) $(note_con).removeClass("highlighted");
                                                    highlight_colored_tags(note_con);
                                                } 
                                            });
                                        }
                                    });
                                }else{
                                    //如果是新便签，则直接勾选框
                                    $(note_con).addClass("task");
                                }
                            }

                            //去掉之前打下的两个空格
                            if(window.getSelection){
                                var s = window.getSelection();
                                var range = s.getRangeAt(0);
                                range.setStart(s.anchorNode,0);
                                range.setEnd(s.anchorNode,cursorPos);
                                if(/\s+/.test(range.toString())){
                                    range.deleteContents();
                                }
                                
                                range.detach();
                                range = null;
                            }else if(document.selection){
                                //针对ie
                                var textRange = document.body.createTextRange();
                                    textRange.moveToElementText(editable);
                                    textRange.moveStart(0);
                                    textRange.moveEnd(-textRange.text.length+2);
                                    if(textRange.text.length == 2 && /\s+/.test(textRange.text)){
                                        textRange.text = "";
                                    }
                            }
                        }
                    }
                }

                //在可编辑区域中的开始部分敲下两个空格即为任务
                if(event.keyCode && event.keyCode == "32" && !$(this).hasClass("task")){
                    var lastInput = getLastInput(editable);

                    if(cursorPos == 1 && /\s/.test(lastInput)){
                        //在打头处敲下空格键，记录下来，为下次敲击做准备
                        $(this).data({"hit_space_count":1,"hit_space_time":Date.now()});
                    }else if(cursorPos == 2 && /\s/.test(lastInput)){
                        Tracker.sendEvent('Note Operations','two space task');
                        if($(this).data("hit_space_count") == 1){

                            var hit_space_time = $(this).data("hit_space_time");

                            //两次空格键按下的时间必须超过一定值才添加任务
                            if(Date.now() - hit_space_time > 500){
                                return ;
                            }

                            $(this).addClass("task");

                            //如果不是新的便签，则为其添加上任务标签
                            if(!$(this).hasClass("new")){
                                var that = this;
                                var task_id = $("#tag_tasks").data("id");
                                note.addTag(task_id,function(feedback){
                                    if(feedback.status == "ok"){
                                        note.deadline = null;
                                        note.setTask(function(feedback){
                                            if(feedback.status == "ok"){
                                                idl.LM.updateNote({
                                                    type: "task",
                                                    value: "create",
                                                    id: note.id,
                                                    task_id: feedback.task_id,
                                                    position: feedback.position
                                                });

                                                $(note_con).addClass("task");
                                                $(note_con).attr({"data-task-id":feedback.task_id,"data-position":feedback.position}).data({"position":feedback.position,"task-id":feedback.task_id});
                                                //如果添加的当前的标签有色彩值，则需要为新建的便签加上色彩值
                                                var color = $("#tag_tasks").data("color");
                                                
                                                if(!!color){
                                                    $("form",that).append("<div class=\"default_tag\" data-id=\""+task_id+"\" style=\"background:"+color+"\"></div>");
                                                }

                                                if($(note_con).hasClass("highlighted")) $(note_con).removeClass("highlighted");
                                                highlight_colored_tags(note_con);
                                            } 
                                        });
                                    }
                                });
                            }else{
                                //如果是新便签，则直接显示勾选框(在样式上显示为任务)
                                $(note_con).addClass("task");
                            }

                            //去掉之前打下的两个空格
                            if(window.getSelection){
                                var s = window.getSelection();
                                var range = s.getRangeAt(0);
                                range.setStart(s.anchorNode,0);
                                range.setEnd(s.anchorNode,cursorPos);
                                if(/\s+/.test(range.toString())){
                                    range.deleteContents();
                                }
                                range.detach();
                                range = null;
                            }else if(document.selection){
                                //针对ie
                                var textRange = document.body.createTextRange();
                                    textRange.moveToElementText(editable);
                                    textRange.moveStart(0);
                                    textRange.moveEnd(-textRange.text.length+2);
                                    if(textRange.text.length == 2 && /\s+/.test(textRange.text)){
                                        textRange.text = "";
                                    }
                            }
                        }
                    }
                }else if(event.keyCode && event.keyCode == "8" && $(this).hasClass("task")){
                    if(cursorPos == 0){
                        if($(this).data("hit_del_count")){
                            if($(this).data("hit_del_count") == "1"){

                                var hit_del_time = $(this).data("hit_del_time");

                                //两次删除键按下的时间必须超过一定值才移除任务
                                if(Date.now() - hit_del_time > 500){
                                    return ;
                                }

                                Tracker.sendEvent('Note Operations','two space del task');
                                $(this).removeClass("task");

                                //如果不是新的便签，则为其去掉任务标签
                                if(!$(this).hasClass("new")){
                                    var that = this;
                                    var task_id = $("#tag_tasks").data("id");
                                    note.task_id = $(note_con).data("task-id");

                                    //去掉任务标签
                                    note.removeTag(task_id,function(feedback){
                                        if(feedback.status == "ok"){
                                            //更新本地数据
                                            idl.LM.updateNote({
                                                type: "tag",
                                                value: "-"+task_id,
                                                id: note.id
                                            });

                                            NotificationCenter.remove({id:note.id});

                                            //删除任务
                                            note.unsetTask(function(feedback){
                                                if(feedback.status == "ok"){
                                                    if($("#search_results").hasClass("results-of-tasks")){
                                                        $(note_con).remove();
                                                    }else{
                                                        $(note_con).removeClass("task");

                                                        //去掉任务标签的色块
                                                        $(that).find(".default_tag[data-id=\""+task_id+"\"]").remove();

                                                        if($(note_con).hasClass("highlighted")) $(note_con).removeClass("highlighted");
                                                        highlight_colored_tags(note_con);
                                                    }
                                                }else{
                                                    //操作失败
                                                }
                                            });
                                        }
                                    });
                                }else{
                                    //如果是新便签，则直接去掉勾选框
                                    $(note_con).removeClass("task");
                                }
                                
                                $(this).removeData("hit_space_count").removeData("hit_del_count").removeData("hit_space_time");
                            }
                        }else{
                            $(this).data({"hit_del_count":1,"hit_del_time":Date.now()});
                        }
                    }
                }
            });

            $("#wrapper").on("keydown",".note-con form",function(event){
                event = EventUtil.getEvent(event);
                
                //快捷键 Ctrl/Cmd + S
                if(event.keyCode && event.keyCode == 83 && (event.metaKey || event.ctrlKey)){
                    Tracker.sendEvent('Save Note','keyboard shortcut');
                    EventUtil.preventDefault(event);
                    
                    var $note_con = $(this).parent(),
                        $txtarea = $note_con.find(content_area),
                        save_id = $note_con.data("id");

                    if($note_con.hasClass("saving") || !$note_con.hasClass("modified") || $note_con.hasClass("saved")){
                        $(".loading-bar").remove();
                        $(this).append("<div class=\"loading-bar\"></div>");
                        $(".loading-bar").animate({width:"100%",opacity:0});
                    }else{
                        $(this).submit();
                    }
                }
            });

            $("#blank_sheet").on("click "+downEvent,".note-con .submit",function(event){
                event = EventUtil.getEvent(event);
                EventUtil.preventDefault(event);
                $note_con = $("#blank_sheet .note-con");
                Tracker.sendEvent('Create New Note','OK button');

                $("#blank_sheet .new form").submit();
                
                if($("#blank_sheet .note-con.new").length == 0){
                    Note.prototype.addBlank();
                    //$("#notes_con .range-title").first().after($note_con.get(0));
                    $("#notes_con "+all_saved_con+" .range-title").first().after($note_con.get(0));
                    
                    $note_con.find(content_area).each(function(){
                        var content = decode_content(this.innerHTML,true);
                        $(this).html(content);
                        configure_height(this);
                        load_image_entity(this);
                    });
                }
            });

            //提交记事表单进行保存,保存至远程数据库
            $("#wrapper").on("submit",".note-con form.note",function(event){
                event = EventUtil.getEvent(event);
                EventUtil.preventDefault(event);

                var field = $(this).find("div.note.editable").get(0),
                    content = field.innerHTML,
                    that = this,
                    title = "",
                    note_con = this.parentNode,
                    id = 0;

                //使用tab键时，会促发blur和focus，但便签并没有进入编辑状态，blur时会自动保存，此时保存的是可读模式下的内容，是错的
                //所以非编辑模式下的内容不保存                    
                if($(field).attr("contenteditable") == "false" || $(field).attr("contenteditable") == undefined){
                    return false;
                }

                if($.trim(content) == "" || $.trim($(field).text()) == ""){
                    if(!($("body").hasClass("touch-device"))){
                        field.focus();
                    }
                    return false;
                }

                content = encode_content(content,true);
                
                field.innerHTML = content;

                var title = get_title(content);
                if($(note_con).data("id")){
                    id = $(note_con).data("id");
                }

                //如果内容没有发生变化则给出提示并返回
                if(content == $(field).data("value")){
                    //showMessage({"type":"success","msg":"已保存"});
                    return false;
                }

                //如果内容长度超过5000字建议在两个便签中书写
                if(content.length > 5000){
                    showMessage({type:"warning",msg:"你输入的内容长度("+content.length+"字符)超过了5000字符，请将超过部分("+(content.length-5000)+"字符)保存于另一份便签中"});
                    return false;
                }

                var note = new Note({"id":id,"title":title,"content":content});
                $(note_con).removeClass("saved").addClass("saving");

                if(note.id > 0){
                    $(".loading_bar").remove();
                    $(that).append("<div class=\"loading-bar\"></div>");
                }else{
                    var extra_html = "<div class=\"bottom-menu\">" +
                                "<div class=\"op\"><a href=\"#\" class=\"more\"></a></div>" +
                                "<div class=\"op exit\"><a href=\"#\" class=\"share\"><span data-tooltip=\""+_translate("alt_note_share")+"\" class=\"ok-icon-share icon-font\"></span></a></div>"+
                                "<div class=\"op hidden\"><a href=\"#\" class=\"del\"><span data-tooltip=\""+_translate("alt_note_delete")+"\" class=\"ok-icon-delete icon-font\"></span></a></div>"+
                                "<div class=\"op hidden\"><a href=\"#\" class=\"cal\"><span data-tooltip=\""+_translate("alt_note_task")+"\" class=\"ok-icon-calendar icon-font\"></span></a></div>"+
                                "<div class=\"op hidden\"><a href=\"#\" class=\"tags\"><span data-tooltip=\""+_translate("alt_note_tags")+"\" class=\"ok-icon-tages icon-font\"></span></a></div>"+
                                "<div class=\"op hidden\"><a href=\"#\" class=\"info\"><span data-tooltip=\""+_translate("alt_note_detail")+"\" class=\"ok-icon-info icon-font\"></span></a></div>"+ 
                            "</div>" + 
                            "<div class=\"top-ops\">" + 
                                "<a href=\"#\" class=\"clear-link\"><span data-tooltip=\""+_translate("alt_clear_link")+"\" class=\"ok-icon-link icon-font\"></span></a>" +
                                "<a href=\"#\" class=\"maximize-note\"><span data-tooltip=\""+_translate("alt_maximize_note")+"\" class=\"ok-icon-maximum icon-font\"></span></a>" +
                                "<a href=\"#\" class=\"minimize-note\"><span data-tooltip=\""+_translate("alt_minimize_note")+"\" class=\"ok-icon-minimum icon-font\"></span></a>" +
                            "</div>" +
                            "<a href=\"#\" class=\"drag_trigger sort_trigger\"><span class=\"icon-font ok-icon-drag\"></span></a>";


                    $(note_con).append("<div class=\"strips\"></div>")
                                .find("form").append(extra_html)
                                .find(".bottom").remove();

                    $(field).removeAttr("data-tooltip").removeAttr("data-i18ntooltip");

                    //通知css笔记已经放入面板
                    $(note_con).addClass("ready")

                    //放入当前标签面板
                    $("#search_results .by-tag.result .tag-result.show").prepend(note_con);
                    
                    $(note_con).find(content_area).each(function(){
                        read_mode(this);

                        //设定高度
                        configure_height(this);

                        load_image_entity(this);
                    }).end().removeClass("ready").addClass("finish-layout").attr("data-created",Date.now());

                    if($("#blank_sheet .note-con").length == 0){
                        //确保只有一个新记事才添加新的空白记事
                        Note.prototype.addBlank();
                    }
                }

                note.save(function(feedback){
                    
                    setTimeout(function(){
                        jQuery(".finish-layout").each(function(){
                            if(Date.now() - jQuery(this).data("created") > 500){
                                jQuery(this).removeClass("finish-layout");
                            }
                        });
                    },2000);

                    if(feedback.status == "ok"){
                        $(".loading_bar").css({width:that.offsetWidth,opacity:0});
                        $(note_con).removeClass("saving modified");

                        if(window.top == self){
                            if(window.postMessage) window.postMessage({command:"open_login_window"},"*");
                        }else{
                            //通知插件
                            if(window.postMessage) window.parent.postMessage({command:"open_login_window"},"*");
                        }

                        if(feedback.id){
                            //添加的是新便签，其类别必须是notes或tasks其中之一，
                            note.id = feedback.id;
                            note.created = get_current_time();

                            //保存成功，如果用户装了插件，每创建5条便签弹出一次登录框，如果没装插件则提示装插件
                            if(APP.notes.length % 5 == 0){
                                if(APP.ext_installed){
                                    APP.toggle_authwin();
                                }else{
                                    APP.show_install_btn();
                                }
                            }

                            //新建的便签
                            //将本地存储中的new_note记录删除
                            if(localStorage) localStorage.removeItem("new_note");

                            $(note_con).attr({"id":"note-"+feedback.id,"data-id":feedback.id})
                                        .addClass("saved sortable newly_saved");

                            //保存之后，只有在当前编辑文本框失焦之后才创建新的记事
                            $(field).data("value",content);

                            //将便签进行分类
                            //默认分类为当前选项卡
                            var default_type = "all",
                                $active_tag = $("#search_area .by-tag .tag.active");

                            //系统自动添加标签
                            if(/\bresults\-of\-(tasks|contacts|notes|links|images)\b/.test($("#search_results").attr("class"))){
                                //如果是在默认五大分类面板中添加
                                default_type = $("#search_results").attr("class").match(/\bresults\-of\-(tasks|contacts|notes|links|images)\b/)[1];
                                $active_tag = $("#tag_"+default_type);
                            }else if($("#search_results").hasClass("custom-tag-results")){
                                //自定义标签面板中添加
                                default_type = "custom";
                                $active_tag = $("#search_area .by-tag .tag.active");
                                
                                note.addTag($active_tag.data("id"),function(feedback){
                                    if(feedback.status == "ok"){
                                        //如果添加的当前的标签有色彩值，则需要为新建的便签加上色彩值
                                        var color = $active_tag.data("color");
                                        
                                        if(!!color){
                                            $(that).append("<div class=\"default_tag\" data-id=\""+$active_tag.data("id")+"\" style=\"background:"+color+"\"></div>");
                                            if($(note_con).hasClass("highlighted")) $(note_con).removeClass("highlighted");
                                            highlight_colored_tags(note_con);
                                        }
                                    }
                                });
                            }

                            //在任务面板中添加便签
                            if(default_type != "all" && default_type == "tasks") $(note_con).addClass("task");

                            //本地数据更新
                            idl.LM.addNote({
                                id: note.id,
                                is_task: $(note_con).hasClass("task"),
                                content: note.content,
                                finished: 0,
                                tag_id: $active_tag.data("id"),
                                timestamp: Date.now()
                            });

                            //新建的便签是否有task类，若有则需要加上tasks标签，
                            //1.在任务面板 因为tasks页面会自动在classify函数中添加tasks标签，所以这里不作操作
                            //2.非任务面板 需手动加上tasks标签
                            if(default_type != "tasks" && $(note_con).hasClass("task")){
                                note.addTag($("#tag_tasks").data("id"),function(feedback){
                                    if(feedback.status == "ok"){
                                        var color = $("#tag_tasks").data("color");

                                        if(!!color){
                                            $(that).append("<div class=\"default_tag\" data-id=\""+$("#tag_tasks").data("id")+"\" style=\"background:"+color+"\"></div>"); 
                                            if($(note_con).hasClass("highlighted")) $(note_con).removeClass("highlighted");
                                            highlight_colored_tags(note_con);
                                        }

                                        //将任务设为今日任务
                                        var date = get_formated_time(Date.now(),false);
                                        note.deadline = null;
                                        note.setTask(function(response){
                                            if(response.status == "ok"){
                                                //更新本地数据
                                                idl.LM.updateNote({
                                                    type: "create",
                                                    value: null,
                                                    id: note.id,
                                                    task_id: response.task_id,
                                                    position: response.position
                                                });


                                                if(response.task_id && response.task_id > 0){
                                                    //将任务id加入便签中
                                                    $(note_con).attr({"data-task-id":response.task_id,"data-position":response.position}).data({"position":response.position,"task-id":response.task_id});
                                                    $("form",note_con).append("<div class=\"deadline\"><span>"+note.deadline+"</span></div>");
                                                    recount_today_tasks("addnew");
                                                }
                                            }else{
                                                //发生错误
                                            }
                                        });
                                    }
                                });
                            }

                            //系统自动分类
                            note.classify(default_type,function(o){
                                if(console) console.log(o);
                                var stick_types = o.types ? o.types : new Array();
                                var feedback = o.data;
                                if(feedback.status && feedback.status == "ok"){
                                    //为便签添加上相应的颜色
                                    var default_tag = null,color="";
                                    var tag_id;

                                    for(var i=0,len=stick_types.length; i<len; i++){
                                        default_tag = $("#tag_"+stick_types[i]).get(0);
                                        tag_id = $(default_tag).data("id");

                                        //更新本地数据
                                        idl.LM.updateNote({
                                            type: "tag",
                                            value: "+"+tag_id,
                                            id: note.id
                                        });

                                        if(stick_types[i] == "tasks") jQuery(note_con).addClass("task");

                                        if(default_tag){
                                            color = $(default_tag).data("color");

                                            //如果添加的标签含有颜色值，并且便签中不包含该颜色块则为其添加颜色块
                                            if(!!color && $(that).find(".default_tag[data-id=\""+$("#tag_"+stick_types[i]).data("id")+"\"]").length == 0){
                                                if(stick_types[i] == 'links'){
                                                    $('.strips',note_con).prepend("<div class=\"default_tag\" data-id=\""+$("#tag_"+stick_types[i]).data("id")+"\" style=\"background:"+color+"\"></div>");
                                                }else if(stick_types[i] == 'contacts'){
                                                    $('.strips',note_con).append("<div class=\"default_tag\" data-id=\""+$("#tag_"+stick_types[i]).data("id")+"\" style=\"background:"+color+"\"></div>");
                                                }
                                            }
                                        }

                                        //添加上了对应的标签，如果标签处于在本地已经有缓存的状态，则将此条新便笺加入其缓存
                                        var $tag_result_con = $(".tag-result.tag-"+tag_id);
                                        if($tag_result_con.length > 0 && !$tag_result_con.hasClass("show")){
                                            var $tag = $("#search_area a.tag[data-id=\""+tag_id+"\"]");
                                            var current_tag_num = $tag.data("num") ? $tag.data("num") : $tag_result_con.find(".note-con").length;

                                            //放到对应的标签面板中
                                            $tag_result_con.prepend($(note_con).clone(true,true));
                                        }
                                    }
                                }else{
                                    console.log(o);
                                }
                            });
                            
                            //如果不是"所有"标签下，则还要拷贝一份到"所有"标签下
                            var $all_result_con = $(".tag-result.tag-0");
                            if($all_result_con.length > 0 && !$all_result_con.hasClass("show")){
                                var $all_tag = $("#search_area .tag-con.all a.tag");
                                var current_all_num = $all_tag.data("num") ? $all_tag.data("num") : $all_result_con.find(".note-con").length;
                                $all_tag.data({"last_refresh":get_current_time(),"num":current_all_num+1})
                                        .attr({"data-num":current_all_num+1,"data-last_fresh":get_current_time()});
                                $all_result_con.prepend($(note_con).clone(true,true));
                            }

                            //更新计数
                            recount_in_tag("addnew");
                            
                            if($active_tag){
                                var current_num = $active_tag.data("num");
                                $active_tag.data("num",current_num+1);
                            }

                            //添加地理位置
                            if($("body").hasClass("geo_on")){
                                get_position(function(lnglat){
                                    if(lnglat){
                                        var coords = lnglat.lat + "|" + lnglat.lng;
                                        note.add_coords(coords,function(data){
                                            if(console) console.log(data);
                                        });
                                    }
                                });
                            }

                            if($("#blank_sheet .note-con.new").length > 0){
                                return false;
                            }

                            //确保只有一个新记事才添加新的空白记事
                            Note.prototype.addBlank();
                        }else{
                            $(".loading-bar").animate({width:"100%",opacity:0});
                            //修改的便签,
                            if(!!localStorage){
                                note.modified = get_current_time();
                                //删除本地存储中的对应条目
                                var modified_notes_str = localStorage.getItem("modified_notes");
                                if(!!modified_notes_str){
                                    var modified_notes = $.parseJSON(modified_notes_str);
                                        if(modified_notes[note.id]){
                                            delete modified_notes[note.id];
                                            localStorage.setItem("modified_notes",JSON.stringify(modified_notes));
                                        }
                                }
                            }

                            $(note_con).addClass("saved");
                            $(field).data("value",content);

                            //添加地理位置
                            if($("body").hasClass("geo_on")){
                                get_position(function(lnglat){
                                    if(console) console.log(lnglat);
                                    if(lnglat){
                                        var coords = lnglat.lat + "|" + lnglat.lng;
                                        note.add_coords(coords,function(data){
                                            if(console) console.log(data);
                                        });
                                    }
                                });
                            }

                            //更新本地数据
                            idl.LM.updateNote({
                                type: "content",
                                id: note.id,
                                value: content
                            });
                        }
                    }else{
                        //showMessage({type:"error",msg:"记事失败"});
                    }
                });
                return false;
            });//保存记事结束
	}

	initialize();

    function check_local_saved(when){
        if(when == "beforeunload"){
            //发送同步请求
            Tracker.end();
        }

        if(!!localStorage){
            var modified_notes_str = localStorage.getItem("modified_notes");
            var new_note_str = localStorage.getItem("new_note");

            if(modified_notes_str || new_note_str){
                var modified_notes = $.parseJSON(modified_notes_str);
                var new_note = $.parseJSON(new_note_str);
                var modified_exist = (!!modified_notes && !$.isEmptyObject(modified_notes));
                
                var new_note_exist = (!!new_note && !$.isEmptyObject(new_note) && $.trim(new_note.content) != "" && $.trim(new_note.content) != "<br>");
                if( modified_exist || new_note_exist ){
                    //如果本地存储中存在未被保存的便签则保存并给予用户提示
                    var id,note,noteobj;
                    if(modified_exist){
                        modified_exist = false;

                        for(id in modified_notes){
                            $note = $(".note-con[data-id=\""+id+"\"]");
                            noteobj = modified_notes[id];

                            //仅仅在用户修改了的情况下进行保存
                            if($note.find(content_area).data("value") != noteobj.content){
                                note = new Note({id:id,content:noteobj.content});
                                note.save(function(feedback){
                                    if(feedback.status == "ok"){
                                        //下面这句主要针对页面关闭时不能保存的设备如ipad
                                        $note.find(content_area).html(noteobj.content);
                                    }

                                    //保存之后将其删除
                                    $note.removeClass("modified");
                                    delete modified_notes[id];
                                    localStorage.setItem("modified_notes",JSON.stringify(modified_notes));
                                });
                                modified_exist = true;
                            }else{
                                delete modified_notes[id];
                                localStorage.setItem("modified_notes",JSON.stringify(modified_notes));
                            }
                        }
                    }

                    if(new_note_exist){
                        if(when == "onload"){
                            //下面主要针对页面关闭时不能保存的设备如ipad
                            //页面加载时若有未保存的新便签(可能是因为关闭时未保存)则将其放入输入框
                            $("#blank_sheet .note-con.new").data("value",new_note.content).data("created",new_note.created).data("stamp",new_note.stamp).addClass("modified").find(content_area).html(new_note.content);
                        }else if(when == "beforeunload"){
                            //用户离开页面时，若有未保存的便签则将其保存

                            // note = new Note({id:0,content:new_note.content});

                            // note.save(function(data){
                            //     var feedback = get_json_feedback(data);
                            //     if(feedback.status == "ok"){
                                    
                            //     }
                            // });

                            // localStorage.removeItem("new_note");
                        }
                    }
                }

                //如果是新便签，若内容为空则不保存也不提示用户
                if($("#blank_sheet .note-con.modified").length > 0){
                    var new_content = $("#blank_sheet .note-con.modified").find(".note.editable").html();
                    //如果此刻正在编辑的新便签为空，则移除所保存的空本地便签
                    if($.trim(new_content) == "" || $.trim(new_content.replace(/\&nbsp\;/ig,"")) == ""){
                        localStorage.removeItem("new_note");
                        return false;
                    }else{
                        //若新便签非空，而且本地未保存，则将其保存在本地
                        if(!new_note_exist){
                            var new_note = {id: 0,content: new_content,created:get_current_time(),saved:0,stamp:Date.now()};
                                localStorage.setItem("new_note",JSON.stringify(new_note));
                                return false;
                                //return true;
                        }else{
                            return false;
                        }
                    } 
                }
                return false;
                //return modified_exist || $("#wrapper .note-con.modified").length > 0;
            }
        }
    }

    //打开网页时检测本地存储是否有未被保存的便签，有则保存，再将其记录删除
    check_local_saved("onload");

    //在离开页面之前检查未保存的便签并将其保存
    if("onbeforeunload" in window){
        window.onbeforeunload = function(){
            //如果有未保存的便签则保存之后再关闭
            if(check_local_saved("beforeunload")){
                return "网页中存在未保存的便签,正在保存中,此时离开网页正在保存的内容将丢失,确定离开吗？";
            }
        };
    }

    function set_fetch_timer(tag_id,results_con){
        if(isNaN(tag_id)){
            return false;
        }

        results_con = results_con ? results_con : "#search_results .by-tag .tag-result.tag-"+tag_id;
        var $fetch_tag = $("#search_area .by-tag a.tag[data-id=\""+tag_id+"\"]");

        if(idl.tag_fetchint){
            clearInterval(idl.tag_fetchint);
        }
        //为此标签添加一个定时抓取的程序，当后台有便签更新或添加时，前台自动刷新
        idl.tag_fetchint = setInterval(function(){
            var last_refresh = $fetch_tag.data("last_fetch");
            //如果不存在最后索取时间或正在索取则返回
            if($(results_con).hasClass("fetching")){
                return false;
            }

            if(!!!last_refresh){
                last_refresh = get_current_time();
                $fetch_tag.data("last_fetch",get_current_time());
            }

            $(results_con).addClass("fetching");
            //if(console) console.log("fetch in tag");
            Note.prototype.fetch_in_tag(tag_id,last_refresh,function(data){
                //if(console) console.log(data);
                if(!!!data){
                    //若没有新的或修改的便签，刷新更新时间也不变
                    $(results_con).removeClass("fetching");
                    return false;
                }

                var feedback = get_json_feedback(data);

                if(feedback.status && feedback.status == "ok"){
                    var notes = feedback.new_notes ? feedback.new_notes : null;
                    //更新刷新时间
                    $fetch_tag.data("last_fetch",get_current_time());

                    if(notes){
                        //在所有记事的前面展示
                        for(var i=0,len=notes.length; i<len; i++){
                            var noteobj = notes[i];
                            if(notes[i] && notes[i].fetch_type == "0"){
                                //如果是新建的便签
                                //如果当前页面含有相同id的便签，则只对内容进行修改，如果有其他属性修改如已删除或已存档则让
                                if($(results_con + " .note-con[data-id=\""+noteobj.id+"\"]").length > 0){
                                    $(results_con + " .note-con[data-id=\""+noteobj.id+"\"] "+content_area).html(decode_content(noteobj.content)).data("value",noteobj.content);
                                }else{
                                    //否则，将便签插入到最前面
                                    //如果新建的便签为当前浏览用户创建则不显示出来
                                    if($("#blank_sheet .note-con").data("id") != noteobj.id){
                                        var note = new Note(noteobj);
                                        note.construct_item("fetched_tag_note");
                                        
                                        $(results_con).prepend(note.html);
                                        
                                        //标题旁的计数加一
                                        recount_in_tag("addnew");
                                    }
                                }
                            }else{
                                if(noteobj.id){
                                    if(noteobj.is_deleted == "1"){
                                        $(results_con + " .note-con[data-id=\""+noteobj.id+"\"]").fadeOut(function(){
                                            $(this).remove();
                                            //标题旁的计数减一
                                            recount_in_tag("delete");
                                        });
                                    }

                                    //如果更新过了的便签更新的是完成属性，
                                    if(noteobj.finished == "1"){
                                        //任务被完成
                                        $(results_con + " .note-con.task[data-id=\""+noteobj.id+"\"]").find(".checkbox").each(function(){
                                            //如果存在此条便签
                                            if(!$(this).hasClass("checked")){
                                                $(this).trigger("click");
                                            }
                                        });
                                    }else if(noteobj.finished == "0"){
                                        //任务被恢复
                                        $(results_con + " .note-con.task[data-id=\""+noteobj.id+"\"]").find(".checkbox.checked").each(function(){
                                            //如果面板中存在此条便签，则直接恢复
                                            $(this).trigger("click");
                                        });
                                    }
                                    
                                    if($(results_con + " .note-con[data-id=\""+noteobj.id+"\"]").length > 0){
                                        //如果是修改的便签，找到对应的便签再进行更新
                                        if($(results_con + " .note-con[data-id=\""+noteobj.id+"\"] "+content_area).data("value") != noteobj.content){
                                            $(results_con + " .note-con[data-id=\""+noteobj.id+"\"] "+content_area).html(decode_content(noteobj.content)).data("value",noteobj.content);
                                        }
                                    }else{
                                        //不存在此便签有两种情况
                                        //1.新建便签
                                        //2.删除的便签
                                        if(console) console.log(noteobj);

                                        if($("#blank_sheet .note-con").data("id") != noteobj.id && noteobj.is_deleted != "1"){
                                            var note = new Note(noteobj);
                                                note.construct_item("fetched_tag_note");
                                            
                                            $(results_con).prepend(note.html);
                                            //标题旁的计数加一
                                            recount_in_tag("addnew");
                                        }
                                    }
                                    
                                }
                            }
                        }

                        //给从服务器取来的便签decode_content,拉伸高度
                        $(results_con + " .fetched_tag_note").each(function(){
                            var $note = $(this).find(content_area);
                            if($note.html()){
                                $note.data("value",$note.html());
                                var content = decode_content($note.html(),true);
                                
                                $note.html(content);
                                configure_height($note.get(0));
                                load_image_entity($note.get(0));
                            }
                        }).removeClass("fetched_tag_note");
                        //给含有彩色标签的便签附上颜色
                        highlight_colored_tags();
                    }
                }

                //遍历完之后去掉正在索取标识
                $("#search_results .by-tag").removeClass("fetching");
            });
        },5000);
    }

    function sort_notes(){
        //拖拽排序，同时还要判断便签是否由今日拖到了以后或者相反，若是由今日拖入了以后则需要，则去掉其任务，若是由以后拖入了今日则需要将便签的截止日期设为今日
        $("#notes_con").addClass("sorted");
        $("#search_results.results-of-tasks .note-con.task").sortable({trigger:"a.drag_trigger",itemdata:"id",sortdata:"position"},function(sortdata){
            if(!!sortdata.itemsort){
                var sortstr = sortdata.itemsort;
                console.log(sortdata.itemsort);
                var moveid = sortdata.srcdata.id;
                var srcdata = sortdata.srcdata;
                var dstdata = sortdata.dstdata;

                //如果顺序未被改变则返回
                if(srcdata.position == dstdata.position && srcdata.id == dstdata.id){
                    return false;
                }
             
                //如果顺序并没有被改变则返回
                if($("#note").data("order") && sortstr == $("#note").data("order")){
                    return false;
                }
                var note_id = sortdata.srcdata.id,
                    $moved_note = $(".note-con[data-id=\""+note_id+"\"]")
               
                //如果移动的是新建的任务
                if($moved_note.hasClass("newly_saved")){
                    //如果原来的位置是低于移动到的位置，则更改移动到的位置
                    if(srcdata.position < dstdata.position){
                        if($moved_note.next().data("position")){
                            dstdata.position = $moved_note.next().data("position");
                        }
                    }
                }

                Note.prototype.set_display_order_beta(srcdata.position,dstdata.position,function(data){
                    if(console) console.log(data);
                    var feedback = get_json_feedback(data);
                    if(feedback.status == "ok"){
                        //重设order值
                        var note = new Note({id:note_id});
                            note.task_id = $moved_note.data("task-id");

                        //由下面移到上面
                        if(srcdata.position < dstdata.position){

                            //由下面移动到上面，如果被移动的便签在之前是“以后”列表中的任务，被移入了今日，则将便签设为今日任务
                            if(!$moved_note.hasClass("today") && $moved_note.offset().top < $("h1.later-area").offset().top){
                                note.deadline = get_formated_time(Date.now(),false);

                                NotificationCenter.queue({
                                    id:note.id,
                                    task_id: note.task_id,
                                    content: process_sharetext($moved_note.find(".editable").html()),
                                    deadline: todayDate
                                });


                                console.log("move to today-area");
                                //如果已经设置了截止日期，则修改截止日期
                                note.setDeadline(false,function(data){
                                    if(console) console.log(data);
                                    var feedback = get_json_feedback(data);
                                    if(feedback.status == "ok"){
                                        var $deadline = $moved_note.find("form .deadline");
                                        if($deadline.length > 0){
                                            $deadline.find("span").text(note.deadline);
                                        }else{
                                            $moved_note.find("form").append("<div class=\"deadline\"><span>"+note.deadline+"</span></div>");
                                            $deadline = $moved_note.find("form .deadline");
                                        }

                                        $deadline.removeClass("highlight").offset();
                                        $deadline.addClass("highlight");
                                        //更新计数
                                        recount_today_tasks("change_today");
                                        $moved_note.addClass("today");
                                    }else{
                                        //出错
                                    }
                                });
                            }

                            //更新position
                            change_position("up",srcdata.position,dstdata.position);
                        }else{
                            //如果由今日移入了以后，则将便签设为以后任务，去掉任务
                            if($moved_note.hasClass("today") && $moved_note.offset().top > $("h1.later-area").offset().top){
                                console.log("moved to later area");
                                note.deadline = null;

                                //去掉截止日期
                                note.setDeadline(false,function(data){
                                    if(console) console.log(data);
                                    var feedback = get_json_feedback(data);
                                    if(feedback.status == "ok"){
                                        $moved_note.find("div.deadline").remove();

                                        //更新计数
                                        recount_today_tasks("change_date");

                                        $moved_note.removeClass("today");
                                    }else{
                                        //出错
                                    }
                                });
                            }

                            //更新positon
                            change_position("down",srcdata.position,dstdata.position);
                        }

                        $("#note").data("order",sortdata.itemsort);
                    }
                });
            }
        });
    }

    /**
     * ------ 图片墙 ----
     */

     //打开图片墙
     $("#title_sec a.img-wall-btn").on("click "+downEvent,function(event){
        event = EventUtil.getEvent(event);
        EventUtil.preventDefault(event);

        APP.toggle_authwin();

        // if(!$("body").hasClass("img-wall")){
        //     var winScrollTop = $(window).scrollTop();
        //     init_image_wall();
        //     $("#wrapper").scrollTop(winScrollTop);
        // }else{
        //     var wrapperScrollTop = $("#wrapper").scrollTop();
        //     unload_image_wall();
        //     $(window).scrollTop(wrapperScrollTop);
        // }

        // //更新搜索栏宽度
        // stickyWidth = $('#notes_con .inner-wrapper').width();
        // $("#search_area").width(stickyWidth);
     });


    //对图片墙上的图片数据进行排版，并加上监听事件
    // function load_wall_event(){
    //     var parent_div = $(".image-wall").get(0),
    //         cube_width = 204,
    //         gutter = 20,
    //         $container = $('#container'),
    //         ori_ww = $(parent_div).width(),
    //         con_w = ori_ww - ori_ww%(cube_width+gutter);

    //     //确定容器高度
    //     var scroll_con_height = $("#image_wall").height() - $("#image_wall .operations").height() - $("#image_wall .wall-header").height() - $("#image_wall .multi-choice").height() - 12;
    //     $("#image_wall .con-wrap").height(scroll_con_height);

    //     if($container.data("masonry")) $container.removeData("masonry");
    //     $container.width(con_w).masonry({
    //       columnWidth: cube_width,
    //       itemSelector: '.item',
    //       gutter: gutter
    //     });

    //     $('img',$container.get(0)).width(cube_width).on("load",function(){
    //         $container.masonry();
    //     });

    //     var tmp_ww,tmp_margin;
    //     $(window).on("resize.img_wall",function(event){
    //         //确定容器高度
    //         scroll_con_height = $("#image_wall").height() - $("#image_wall .operations").height() - $("#image_wall .wall-header").height() - $("#image_wall .multi-choice").height() - 12;
    //         $("#image_wall .con-wrap").height(scroll_con_height);

    //         tmp_ww = $(parent_div).width();
    //         con_w = parseInt(tmp_ww/(cube_width+gutter)) * (cube_width+gutter);
            
    //         $container.width(con_w);
    //     });

    //     //滚动加载图片
    //     $("#image_wall .item.loading img").load_img_onscroll({container:"#image_wall .con-wrap"},function(){
    //         //图片加载完成调用
    //         $(this).closest(".item").removeClass("loading");
    //      });
    // } 

    //为图片墙加上tag与图片数据
    function init_image_wall(){
        //打开图片墙
        $("body").addClass("img-wall");

        //加载图片标签
        ImageItem.prototype.get_image_tags(function(data){
            var tags = get_json_feedback(data);
            var tag = null;
            var html = "<div class=\"img-tag checked\"><a href=\"#\">ALL</a></div>";
            for(var i=0,len=tags.length; i<len; i++){
                tag = tags[i];
                html += "<div class=\"img-tag\"><a href=\"#\" data-id=\""+tag.id+"\">"+tag.tag_name+"</a></div>";
            }

            $("#image_wall .img-tags .tags-con").html(html);
        });

        //刷墙
        ImageItem.prototype.load_images(paint_wall);
    }

    //将图片数据附到dom
    function paint_wall(images_data){
        var images = get_json_feedback(images_data);
        var html = "<link rel=\"stylesheet\" href=\""+location.origin+"/layout/image_wall.css\"><link rel=\"stylesheet\" href=\""+location.origin+"/layout/lightbox.css\">";
             html += "<div id=\"container\">";
        var image = null;
        var resizedHeight;
        for(var i=0,len=images.length; i<len; i++){
            image = images[i];
            resizedHeight = (APP.imgwallItemInitWidth/image.width) * image.height;

            html += "<div class=\"item loading\" data-id=\""+image.id+"\" data-tagids=\""+image.tag_ids+"\" data-note=\""+image.note_id+"\">" +
                        "<div class=\"mask\">" +
                            "<div class=\"del-mask\">" +
                                "<p class=\"warn\">已在图片墙排除了这张照片</p>" +
                                "<div>" +
                                    "<a class=\"revocation\" href=\"#\">" +
                                        "<span class=\"info\">撤销</span>" +
                                        "<span class=\"icon\"></span>" +
                                    "</a>" +
                                "</div>" +
                            "</div>" +
                            "<a href=\""+image.url+"\" class=\"lb\" data-lightbox=\"image-1\" data-title=\"My caption\"><img src=\""+location.origin+"/layout/images/1px.gif\" width=\""+idl.apps.image.initWidth+"\" height=\""+resizedHeight+"\" data-height=\""+image.height+"\" data-width=\""+image.width+"\" data-src=\""+image.url+"\"/></a>" +
                        "</div>" +
                        "<div class=\"single-op\">" +
                            "<div class=\"checkbox\"></div>" +
                            "<div class=\"operations\">" +
                                "<a class=\"download\" href=\""+image.url+"\" target=\"_blank\" download=\""+get_filename(image.url)+"\"></a>" +
                                "<a class=\"delete\" href=\"#\"></a>" +
                                "<a class=\"share\" href=\"#\"></a>" +
                            "</div>" +
                            "<div class=\"share-component\">" +
                                "<div class=\"share-icon\"><a href=\"#\" class=\"cancel-share\"></a></div>" +
                                "<div class=\"share-icon\"><a href=\"#\" class=\"qqmail component\"></a></div>" +
                                "<div class=\"share-icon\"><a href=\"#\" class=\"weibo component\"></a></div>" +
                                "<div class=\"share-icon\"><a href=\"#\" class=\"douban component\"></a></div>" +
                                "<div class=\"share-icon\"><a href=\"#\" class=\"qzone component\"></a></div>" +
                                "<div class=\"share-icon\"><a href=\"#\" class=\"tqq component\"></a></div>" +
                                "<div class=\"share-icon\"><a href=\"#\" class=\"gmail component\"></a></div>" +
                            "</div>" +
                        "</div>" +
                    "</div>";
        }
        html += "</div>";
        //加载脚本

        var container = document.getElementById("container").contentWindow.document.body;
        if(container) container.innerHTML = html;
        var script = document.createElement("script");
        script.src = location.origin+"/scripts/jquery.min.js";
        container.appendChild(script);

        script.onload = function(){
            var script = document.createElement("script");
            script.src = location.origin+"/scripts/lightbox.min.js";
            container.appendChild(script);

            var script = document.createElement("script");
            script.src = location.origin+"/scripts/masonry.js";
            container.appendChild(script);

            var utility = document.createElement("script");
            utility.src = location.origin+"/scripts/utility.js";
            container.appendChild(utility);

            utility.onload = function(){
                var script = document.createElement("script");
                script.src = location.origin+"/scripts/image_wall.js";
                container.appendChild(script);
            };
        };

        var scroll_con_height = $("#image_wall").height() - $("#image_wall .wall-op").height() - $("#image_wall .wall-header").height() - $("#image_wall .multi-choice").height() - 12 - 10;

        var parent_div = $(".image-wall").get(0),
            cube_width = 204,
            gutter = 20,
            ori_ww = $(parent_div).width(),
            con_w = ori_ww - ori_ww%(cube_width+gutter);
        $("iframe#container").height(scroll_con_height);

        //if(!$(container).hasClass("inited")) load_wall_event();
    }

    function unload_image_wall(){
        //关闭图片墙
        $("body").removeClass("img-wall");

        //卸载事件
        $(window).off("resize.img_wall");

        //清空数据
        $("#container").html("").removeClass("inited");

        $("#image_wall .img-tags .tags-con").html(""); 
    }

    //关闭图片墙
    $("#image_wall .wall-op").on("click "+downEvent,"a",function(event){
        event = EventUtil.getEvent(event);
        EventUtil.preventDefault(event);

        if($(this).hasClass("close") && $("body").hasClass("img-wall")){
            var wrapperScrollTop = $("#wrapper").scrollTop();
            unload_image_wall();
            $(window).scrollTop(wrapperScrollTop);

            //更新搜索栏宽度
            stickyWidth = $('#notes_con .inner-wrapper').width();
            $("#search_area").width(stickyWidth);
        }
    });

    /*
    * ------ 设置 --------
    */
    // $("header .menu .config").on("click",function(event){
    //     event = EventUtil.getEvent(event);
    //     EventUtil.preventDefault(event);
    //     //要求用户登录
    //     APP.toggle_authwin();
    //     return false;

    //     if(!$("body").hasClass("configuring")){
    //         //取出配置数据，再打开配置配置页面
    //         //本地有缓存就取出本地的
    //         $.get("/user/get_config",{type:"ajax",from:"web"},function(data){
    //             if(console) console.log(data);
    //             var feedback = get_json_feedback(data);

    //             //保存，在后续的更改中还需要更新
    //             //idl.apps.note.config = feedback;

    //             //feedback 所返回的数据应该为以下形式，包括
    //             //1.地理位置开关，2.favicon开关，3.主题编号(是默认的就无返回)，4.字体编号(是默认的就无返回)，
    //             //5.界面语言代码(是默认的就无返回)，6.个性短网址，7.登陆设备以及登录时间地点，8.nickname
    //             display_config(feedback);

    //             //更新搜索栏宽度
    //             stickyWidth = $('#notes_con .inner-wrapper').width();
    //             $("#search_area").width(stickyWidth);
    //         });

    //         //$("body").addClass("configuring");

    //     }else{
    //         //直接关闭页面
    //         $("body").removeClass("configuring");
    //         //更新搜索栏宽度
    //         stickyWidth = $('#notes_con .inner-wrapper').width();
    //         $("#search_area").width(stickyWidth);
    //     }
    // });

    $("#wrapper header .menu").on("click","a",function(event){

        if($(this).hasClass("config")){
            event.preventDefault();
            event = EventUtil.getEvent(event);
            EventUtil.preventDefault(event);
            //要求用户登录
            APP.toggle_authwin();
        }else if($(this).hasClass("refresh")){
            event.preventDefault();
            window.location.reload();
        }else if($(this).hasClass("massage-btn")){
            event.preventDefault();
            $(".main-header").toggleClass("show-list");
        }else if($(this).hasClass("user-btn")){
            event.preventDefault();
            $(".main-header").toggleClass("show-usc");
        }
    });

    $("#settings h2").on("click "+downEvent,"a.back",function(event){
        event = EventUtil.getEvent(event);
        EventUtil.preventDefault(event);

        $("body").removeClass("configuring");

        //更新搜索栏宽度
        stickyWidth = $('#notes_con .inner-wrapper').width();
        $("#search_area").width(stickyWidth);
    });
    
    function display_config(data){
        if(!!!data) return false;
        var nickname = data.nickname,
            lang = data.lang ? data.lang : "zh_cn",
            theme = data.theme ? data.theme : "default",
            font = data.font ? data.font : "default",
            geo_is_on = parseInt(data.geo_is_on),
            favicon_is_on = parseInt(data.favicon_is_on),
            accounts = data.accounts ? data.accounts : null,
            shorturl = data.shorturl ? data.shorturl : null;
            evernote_is_on = data.evernote ? data.evernote : null;
        
        //昵称
        $("#settings .nickname span").text(nickname);
        
        //个性短网址
        if(shorturl){
            $("#settings .fancyurl").addClass("set").find("a.url").text(shorturl).attr("href",shorturl);
        }

        //界面语言
        if(lang != "zh_cn"){
            $(".langs-con .lang.choosed").removeClass("choosed");
            var $li = $(".langs-con .lang a[data-lang=\""+lang+"\"]").parent().addClass("choosed");
            $(".langs-con").prepend($li.get(0));
        }

        //favicon 显示设置
        if(favicon_is_on){
            $(".ui .favicon").addClass("on");
        }else{
            $(".ui .favicon").removeClass("on");
        }

        //界面主题
        if(theme != "default"){
            
        }

        //字体设置
        if(font != "default"){
            $(".fonts-con .font.choosed").removeClass("choosed");
            $(".fonts-con .font a[data-font=\""+font+"\"]").parent().addClass("choosed");
        }

        //地理开关设置
        if(geo_is_on){
            $(".geo .geo-web").addClass("on");
        }else{
            $(".geo .geo-web").removeClass("on");
        }

        //同步的账户
        if(!!account && accounts.length > 0){
            for(var i=0; i<accounts.length; i++){
                var account = accounts[i];
                $(".accounts .open-app."+account).addClass("on");
            }
        }

        if(evernote_is_on == 1){
            $(".accounts .open-app.evernote").addClass("on");
        }


        $("body").addClass("configuring");
    }
    
    //显示网址图标
    $("#settings").on("click "+downEvent,".checkbox",function(event){
        event = EventUtil.getEvent(event);
        EventUtil.preventDefault(event);
        
        var option = this.parentNode;
        if($(option).hasClass("on")){
            //当前状态为开启
            if($(option).hasClass("geo-web")){
                //关闭地理定位特性
                $.post("/user/turn_off_geo",{type:"ajax",from:"web"},function(data){
                    if(console) console.log(data);
                    var feedback = get_json_feedback(data);
                    if(feedback.status == "ok"){
                        $(option).removeClass("on");
                        $("body").removeClass("geo_on");
                        //存储到本地存储
                        var userconfig = localStorage.getItem("user_conf");
                            //更新用户配置
                            if(!!userconfig){
                                //如果存在则直接更新
                                userconfig.geo_is_on = false;
                            }else{
                                //如果不存在则创建一个
                                userconfig = {
                                    geo_is_on: false
                                };
                            }
                            localStorage.setItem("user_conf",JSON.stringify(userconfig));
                    }else{
                        if(console) console.log(data);
                        showMessage({type:"error",msg:_translate("error_off_loc_failed") || "关闭地理定位失败",autoclose:true});
                    }
                });
            }
        }else{
           if($(option).hasClass("geo-web")){
                //检查html5特性是否可用，如果是不可用则无需更新数据库
                if(navigator.geolocation){
                    navigator.geolocation.getCurrentPosition(function(position){
                        var lng = position.coords.longitude,
                            lat = position.coords.latitude,
                            pos = lng+","+lat,
                            latlng = lat+","+lng; 
                            if(console) console.log(pos);
                            //将用户地理位置保存至本地存储或添加dom data
                            //用于以后保存书签时添加地理信息
                            $("body").data("pos",pos);
                            var userconfig = localStorage.getItem("user_conf");

                            //更新用户配置
                            if(!!userconfig){
                                //如果存在则直接更新
                                userconfig.geo_is_on = true;
                            }else{
                                //如果不存在则创建一个
                                userconfig = {
                                    geo_is_on: true
                                }
                            }
                            localStorage.setItem("user_conf",JSON.stringify(userconfig));

                            //与数据库进行同步
                            $.post("/user/turn_on_geo",{type:"ajax",from:"web"},function(data){
                                if(console) console.log(data);
                                var feedback = get_json_feedback(data);
                                if(feedback.status != "ok"){
                                    if(console) console.log(data);
                                    showMessage({type:"error",msg:"开启地理定位失败",autoclose:true});
                                }else{
                                    $(option).addClass("on");
                                    $("body").addClass("geo_on");
                                    $.getScript("http://api.map.baidu.com/geocoder/v2/?ak=CC2dd2781a38600e9c9240b996aee39b&callback=renderReverse&location="+latlng+"&output=json&pois=0");

                                    showMessage({type:"success",msg:"开启地理定位成功"});
                                }
                            });
                    },function(PosError){
                        //PositionError {
                        //   message: "User denied Geolocation", 
                        //   code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3} 
                        switch(PosError.code){
                            //根据状态码判定操作
                            case 1: 
                                //showMessage({type:"warning",msg:"地理定位处于启用状态，如需关闭地理定位可以点击<a href=\"#\" class=\"off-geo\">此处</a>"});
                                break; //用户拒绝定位
                            case 2:
                                // showMessage({type:"warning",msg:"无法获取您的位置信息"}); 
                                break; //硬件不支持或处于无网络连接状态
                            case 3: 
                                // showMessage({type:"warning",msg:"网络连接超时，无法获取您的位置信息"});
                                break; //网络连接慢，获取地理位置超时
                            default: break;
                        }
                    });
                }else{
                    //不可用，则提醒用户更新浏览器，否则无法得到地理位置
                    showMessage({type:"error",msg:"配置失败，您的浏览器不支持地理定位，请下载Chrome,Firefox或Safari"});
                }//检查html5特性是否可用结束
            }
        }
    });

    //鼠标放上时打开下拉菜单
    toggleHvr(null,"#settings .sections div.langs ul,#settings .sections div.fonts ul");

    //登录
    $(".user-info .login-btn").on("click "+downEvent,function(event){
        event.preventDefault();
        APP.toggle_authwin();
    });

    $(".user-info .register-btn").on("click "+downEvent,function(event){
        event.preventDefault();
        APP.toggle_authwin(true);

    });

    //提交登录表单
    $("#login_form").on("submit",function(event){
        event.preventDefault();

        //如果电子邮箱格式不正确或者是密码账号不匹配则直接返回
        if($("#login .wrapper").hasClass("invalid")){
            return ;
        }

        //如果用户用户名密码都不填写直接提交则表明是要注册，将按钮变为注册，相应提示文字进行修改
        var email = this.email.value;
        var pass = this.password.value;
        var submit = this.submit;

        //如果是重设密码
        if($("#login .wrapper").hasClass("resetpass")){
            Tracker.sendEvent("Login Form Related","reset password");
            if(email && email_field_regexp.test(email)){
                $.post("/user/request_pass",{type:"ajax",from:"web","locale": navigator.language || "en",email:email},function(data){
                    console.log(data);
                    var feedback = get_json_feedback(data);
                    if(feedback.status == "ok"){
                        alert( (_translate("msg_pwd_sent",email) || "请到您的邮箱 "+email+" 查阅来自OKMEMO的邮件, 从邮件重设你的密码。"));
                        $("#login .wrapper").removeClass("resetpass");
                        $("#login_form #submit_btn").val(_translate("btn_login") || "登录");
                    }else{
                        if(feedback.msg){
                            if(feedback.msg == "email nonexists"){
                                alert(_translate("btn_email_nonexist") || "此邮箱未被注册");
                            }else if(feedback.msg == "fail to send mail"){
                                alert(_translate("error_send_email") || "发送邮件失败");
                            }
                        }
                    }
                });
            }
            return ;
        }

        if($("#login .wrapper").hasClass("new-user") || $("#login .wrapper").hasClass("old-user")){
            if(email == "" || pass == ""){
                //给出样式上的提醒
                $("#login .wrapper").addClass("invalid");

                //按钮标题改变
                $("#login_form #submit_btn").val(_translate("error_empty_field") || "字段不能为空");
                return false;
            }

            //邮箱格式不正确
            if(!email_field_regexp.test(email)){
                //给出样式上的提醒
                $("#login .wrapper").addClass("invalid");

                //按钮标题改变
                $("#login_form #submit_btn").val(_translate("error_invalid_email") || "邮箱格式不正确");
                return false;
            }
        }

        //登录或者注册成功之后，将本地的数据导入到服务器
        if($("#login .wrapper").hasClass("new-user")){
            //新用户注册
            //检查协议是否勾选
            if($("#login .wrapper .content-area").hasClass("unchecked")){
                // showMessage({type:"warning",msg:_translate("error_agreement") || "必须勾选用户协议才能注册"});
                return false;
            }
            
            //检测密码长度
            $("#login").addClass("sending");
            $("#login_form input").blur();
            
            $.post("/user/create",{type:"adduser",email:email,pass:pass,ts:Date.now()/1000},function(data){
                $("#login").removeClass("sending");
                if(console) console.log(data);
                var feedback = get_json_feedback(data);
                if(feedback.status != "ok"){
                    showMessage({type:"error",msg:feedback.msg});
                }else{
                    localStorage.__logged_in = 1;
                    $("#login").addClass("success");
                    window.location.href = "/";
                }
            });
        }else if($("#login .wrapper").hasClass("old-user")){
            //老用户登录
            $("#login").addClass("sending");
            $("#login_form input").blur();
            $.post("/user/loginauth",{email:email,pass:pass,type:"login",ts:Date.now()/1000},function(data){
                console.log(data);
                var feedback = get_json_feedback(data);
                if(feedback.status == "ok"){
                    localStorage.__logged_in = 1;
                    $("#login").addClass("success");
                    window.location.href = "/";
                }else{
                    $("#login").removeClass("sending");
                    //给出样式上的提醒
                    $("#login .wrapper").addClass("error");

                    //按钮标题改变
                    $("#login_form #submit_btn").val(_translate("error_acct_mismatch") || "邮箱与密码不匹配，登录失败");

                    Tracker.sendEvent("Login Form Related","Login failed");
                }
            });
        }else{
            //如果邮箱密码输入为空
            if(email == "" || pass == ""){
                Tracker.sendEvent("Login Form Related","Click button directly");
                //进入注册页面
                submit.value = "注册";
                $("#login .wrapper").addClass("new-user");
            }else if(email != "" && pass != ""){
                Tracker.sendEvent("Login Form Related","Failed check if email available before submit");
                //没检测完邮箱是否已注册就点击了提交按钮，则作为登录提交
                $("#login .wrapper").addClass("old-user");
                $("#login_form").submit();
            }
        }
    });

    $("#login_form .mail-con input").on("keyup",function(event){
        if(email_field_regexp.test(this.value)){
            $("#login .wrapper").removeClass("wrong-account").addClass("right-account");
        }else{
            $("#login .wrapper").removeClass("right-account").addClass("wrong-account");
        }
    });

    //输入邮箱地址区域，失焦的话，检查邮箱是否可用
    $("#login_form .mail-con input").on("blur",function(event){
        //如果是重设密码则不实时监测
        if(!$.trim(this.value)) return ;
        if($("#login .wrapper").hasClass("resetpass")) return false;
        if($(this).hasClass("checking")) return false;
        var input = this;

        var $login_btn = $("#login_form #submit_btn");
        $login_btn.data("curval",$login_btn.val());

        //如果邮箱不正确则提醒用户
        if($("#login .wrapper").hasClass("wrong-account")){
            $("#login .wrapper").addClass("invalid");
            $login_btn.val(_translate("error_invalid_email") || "邮箱格式不正确");
            return ;
        }else{
            $("#login .wrapper").removeClass("invalid");
            $login_btn.val($login_btn.data("curval"));
        }

        if(email_field_regexp.test(this.value)){
            $(this).addClass("checking");
            $("#login .wrapper").removeClass("wrong-account invalid error").addClass("right-account");
            User.prototype.check_registered(this.value,function(data){
                console.log(data);
                $(input).removeClass("checking");
                var feedback = get_json_feedback(data);

                if(feedback.available){
                    if($("#login .wrapper").hasClass("resetpass")){

                    }else{
                        //此邮箱未被注册过
                        $("#login .wrapper").addClass("new-user").removeClass("old-user");
                        $("#login_form #submit_btn").val(_translate("btn_register") || "注册");
                    }
                }else{
                    if($("#login .wrapper").hasClass("resetpass")){
                        $("#login_form #submit_btn").val(_translate("btn_reset_pass") || "重设密码");
                    }else{
                        //此邮箱已经被注册过
                        $("#login .wrapper").addClass("old-user").removeClass("new-user");
                        $("#login_form #submit_btn").val(_translate("btn_login") || "登录");
                    }
                }
            });
        }else{
            $("#login .wrapper").removeClass("right-account").addClass("wrong-account");
        }
    });

    //关闭窗口
    $("#login a.btn-close").on("click "+downEvent,function(event){
        event.preventDefault();

        $("body").removeClass("login-popup");
    });

    //用户勾选同意协议
    $("#login .agreement a .checkbox").on("click",function(){
        $("#login .wrapper .content-area").toggleClass("unchecked");
    });

    //返回登录
    $("#login .back-login a").on("click "+downEvent,function(event){
        event.preventDefault();
        $("#login .wrapper").removeClass("new-user resetpass").addClass("old-user").find("#submit_btn").val(_translate("btn_login") || "登录");
        Tracker.sendEvent("Login Form Related","Click back login");
    });

    //返回注册
    $("#login .back-register").on("click "+downEvent,function(event){
        event.preventDefault();
        $("#login .wrapper").removeClass("old-user resetpass").addClass("new-user").find("#submit_btn").val(_translate("btn_register") || "注册");
        Tracker.sendEvent("Login Form Related","Click back register");
    });

    //忘记密码
    $("#login .forget-password").on("click "+downEvent,function(event){
        event.preventDefault();

        $("#login .wrapper").addClass("old-user resetpass").removeClass("new-user invalid error").find("#submit_btn").val(_translate("btn_reset_pass") || "重设密码");
    });

    $("#login .other-account .login-icon").on("click "+downEvent,function(event){
        event.preventDefault();
        var login_win = null;
        var third_party = "";
        var newwin_height = 500,
            newwin_width = 800,
            newwin_top = (window.screen.height - newwin_height) / 2,
            newwin_left = (window.screen.width - newwin_width) / 2;

        //打开授权页
        //后台请求第三方服务器授权地址
        //登陆成功
        //如果是第一次授权登录，则保存用户对应数据如第三方账号id,username,screen_name,语言，创建用户，创建session，创建对应用户，直接进入，刷新当前网页
        //如果之前使用此账号登录过
        if($(this).hasClass("facebook")){
            //使用Facebook账号登陆
            third_party = "facebook";
        }else if($(this).hasClass("twitter")){
            //使用Twitter登录
            third_party = "twitter";
        }else if($(this).hasClass("weibo")){
            //使用微博账号登录
            third_party = "weibo";
        }else if($(this).hasClass("weixin")){
            //使用微博账号登录
            third_party = "weixin";
        }else if($(this).hasClass("yinxiang")){
            //使用印象笔记账号登录
            third_party = "yinxiang";
        }else if($(this).hasClass("evernote")){
            //使用evernote账号登录
            third_party = "evernote";
        }else if($(this).hasClass("qq")){
            //使用qq账号登录
            third_party = "qq";
        }else if($(this).hasClass("google")){
            //使用Google账号的登录
            third_party = "google";
        }else if($(this).hasClass("douban")){
            third_party = "douban";
        }

        if(third_party != ""){
            if(third_party == "evernote" || third_party == "yinxiang"){
                login_win = window.open("/loginManager/evernote_route?__sharesource=okmemo",'授权登录','height='+newwin_height+',width='+newwin_width+',top='+newwin_top+',left='+newwin_left+',toolbar=no,menubar=no,scrollbars=yes,resizable=no,location=no,status=no');
            }else{
                login_win = window.open("/loginManager/"+third_party+"?__sharesource=okmemo",'授权登录','height='+newwin_height+',width='+newwin_width+',top='+newwin_top+',left='+newwin_left+',toolbar=no,menubar=no,scrollbars=yes,resizable=no,location=no,status=no');
            }
            if(login_win.onbeforeunload){
                //login_win.onbeforeunload = window.location.reload;
                //窗口关闭之后检查登录是否成功
                //登录成功之后刷新页面

            }else{
                //不支持beforeunload事件的浏览器，如ie，设定刷新器
                //检查窗口是否被关闭
                var check_sync_int = setInterval(function(){
                    console.log(login_win.closed);
                    if(login_win.closed){

                        clearInterval(check_sync_int);
                        //窗口关闭之后检查登录是否成功
                        //登录成功之后刷新页面

                    }
                },500);
            }
        }
    });


    //设置主题色彩
    $(".theme").on("click "+downEvent,function(event){
        event = EventUtil.getEvent(event);
        EventUtil.preventDefault(event);

        var that = this;
        if(!$(this).hasClass("choosed")){
            
            var theme_no = "";

            $.post("/user/switch_theme",{type:"ajax",from:"web",theme_no:theme_no},function(data){
                var feedback = get_json_feedback(data);
                if(feedback.status == "ok"){
                    $(".theme.choosed").removeClass("choosed");
                    $(that).addClass("choosed");
                }else{
                    if(console) console.log(data);
                    showMessage({type:"error",msg:_translate("error_operation_failed") || "设置失败"});
                }
            })
        }
    });

    //设置字体
    $(".font").on("click "+downEvent,function(event){
        event = EventUtil.getEvent(event);
        EventUtil.preventDefault(event);

        var that = this;
        if(!$(this).hasClass("choosed")){
            
            var font_no = "";

            $.post("/user/switch_font",{type:"ajax",from:"web",font_no:font_no},function(data){
                var feedback = get_json_feedback(data);
                if(feedback.status == "ok"){
                    $(".font.choosed").removeClass("choosed");
                    $(that).addClass("choosed");
                }else{
                    if(console) console.log(data);
                    showMessage({type:"error",msg:_translate("error_operation_failed") || "设置失败"});
                }
            })
        }
    });

    //设置界面语言
    $(".lang a").on("click "+downEvent,function(event){
        event = EventUtil.getEvent(event);
        EventUtil.preventDefault(event);

        var that = this;
        var option = this.parentNode;
        if(!$(that).hasClass("choosed")){
            var lang = $(this).data("lang");

            $.post("/user/switch_lang",{type:"ajax",from:"web",lang:lang},function(data){
                if(console) console.log(data);
                var feedback = get_json_feedback(data);
                if(feedback.status == "ok"){
                    var ori_lang = $(".lang.choosed a").data("lang");
                    var new_lang = $("a",option).data("lang");
                    $(".lang.choosed").removeClass("choosed");
                    $(option).addClass("choosed");
                    $("body").removeClass(ori_lang).addClass(new_lang);
                    $("ul.langs-con").removeClass("hvr").prepend(option);
                    showMessage({type:"success",msg:_translate("error_operation_failed") || "设置成功"});
                    window.location.reload();
                }else{
                    if(console) console.log(data);
                    showMessage({type:"error",msg:_translate("error_operation_failed") || "设置失败"});
                }
            });
        }
    });

    //设置分享组件个数和顺序
    //添加或去除分享组件
    $(".share-compo").on("click "+downEvent,function(event){
        event = EventUtil.getEvent(event);
        EventUtil.preventDefault(event);

        var that = this,
            share_compo_no = "";
        if($(this).hasClass("choosed")){
            //去除当前分享组件
            $.post("/user/del_share_component",{type:"ajax",from:"web",share_compo_no:share_compo_no},function(data){
                var feedback = get_json_feedback(data);
                if(feedback.status == "ok"){
                    $(that).removeClass("choosed");
                }else{
                    if(console) console.log(data);
                    showMessage({type:"error",msg:_translate("error_operation_failed") || "设置失败"});
                }
            });
        }else{
            //添加当前分享组件
            $.post("/user/add_share_component",{type:"ajax",from:"web",share_compo_no:share_compo_no},function(data){
                var feedback = get_json_feedback(data);
                if(feedback.status == "ok"){
                    $(that).addClass("choosed");
                }else{
                    if(console) console.log(data);
                    showMessage({type:"error",msg:_translate("error_operation_failed") ||"设置失败"});
                }
            });
        }
    });


});
