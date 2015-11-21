var app = {
    _data: {},  /** 用于保存一些临时的变量 */
    
    initialize: function() {
        this.bindEvents();
    },

    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
        
        $(window).resize(function() {
            page.Map.resizeMap();
        });
    },
    
    onDeviceReady: function() {
        console.log("onDeviceReady");
        
        $("#test").change(function() {
            console.log("changed");
        });
        
        /// 1. 初始化配置
        /// 1.1 初始化位置信息配置 
        settings = app.config("geolocation");
        if (settings === undefined) {
            settings = {};
        }
        
        defaultSettings = {
            startOnBoot: true,                  /// 是否开机自动启动服务
            minDistance: 10,                    /// 仅当位置变动大于此值时才进行位置更新，单位：米（详见 Android 文档中的 LocationManager 章节）
            minTime: 1 * 1000,                  /// 最小定位时间间隔，单位：毫秒（详见 Android 文档中的 LocationManager 章节）
            desiredAccuracy: 1000,              /// 仅接收定位精度小于此值的位置更新，单位：米
            distanceFilter: 10,                 /// 当位置变动大于此值时才记录位置，单位：米
            debug: false,                       /// 调试开关，调试模式下定位成功时会发出声音和提示
            minUploadInterval: 5 * 60 * 1000,   /// 最小上传间隔    
            appLocalUID: account.getUID(),      /// 本地保存的 uid（唯一用户身份或 token，用于校验用户身份）
            uploadOldByCell: false,             /// 是否通过数据连接上传旧位置信息
            maxIdleTime: 5 * 60 * 1000,         /// 获得位置信息后，如果距离上一次定位时间超过此值，则无论如何都会上传最新获得的位置信息
        };
        
        app.config("geolocation", $.extend(defaultSettings, settings));
        
        /// 1.2 初始化 APP 设置
        settings = app.config("app");
        if (settings === undefined) {
            settings = {};
        }
        
        defaultSettings = {
            minUploadInterval: 5 * 60 * 1000,    /// 上传位置信息的最小间隔，单位：毫秒
            uploadOldByCell: false,         /// 在使用数据网络时，是同时否上传旧的位置信息
            distanceFilter: 1,              /// 仅当移动距离大于此值时才收取位置更新通知，单位：米
            desiredAccuracy: 2000,          /// 仅接收定位精度小于此值的位置更新，单位：米（详见 Android LocationManager）
            minDistance: 1,                 /// 仅当位置变动大于此值时才进行位置更新，单位：米（详见 Android LocationManager）
        };
        
        app.config("app", $.extend(defaultSettings, settings));
        
        
        /// 3. 初始化数据库

        
        /// 4. 初始化界面
        var lastLocation = app.config("lastLocation");
        if (lastLocation) {
            gslocation.updateUI(lastLocation);
        }
        
        configInit();
        


        /// L. 完成初始化操作        
        app.checkIsLogined();
        
        gslocation.init();
        
        
        console.log("设备启动成功");
    },
    
    
    updateLocationConfig: function (settings) {
        console.log("重设位置服务的配置: " + JSON.stringify(settings));
        window.pgs.stop();
        window.pgs.configure(gslocation.callbackFn, gslocation.failureFn, settings);
        window.pgs.start();
    },
    
    config: function() {
        var settings;
        
        if (arguments.length >= 2) {
            /// 写入配置
            key = arguments[0];
            val = arguments[1];
            
            settings = localStorage.gslocation_settings;
            if (settings === undefined) {
                settings = {};
            }
            else {
                try {
                    settings = JSON.parse(settings);
                }
                catch (e) {
                    settings = {};
                }
                if (typeof(settings) !== typeof({})) {
                    settings = {};
                }
            }
            
            settings[key] = val;
            localStorage.gslocation_settings = JSON.stringify(settings);
            
            return val;
        }
        else {
            /// 读取配置
            key = arguments[0];
            val = localStorage.gslocation_settings;
            if (val === undefined) {
                return val;
            }
            else {
                try {
                    settings = JSON.parse(val);
                    return settings[key];
                }
                catch (e) {
                    return undefined;
                }
            }
        }
    },
    

    
    /**
     * 快速检查（使用本地信息）当前用户是否已经登录，如果没有登录则提示用户进行登录
     */
    checkIsLogined: function() {
        
        var user = account.getUserLocal();
        if (user) {
            console.log("本地信息显示用户已经登录: " + JSON.stringify(user));
            $(".userinfo").text(user.name + "(" + user.email + ")已登录").slideDown();
            return true;
        }
        
        console.log("本地信息显示用户尚未登录，显示提示窗口");
        
        if ($(".login_tip").length > 0) {
            console.log("已经有一个登录提示窗口了，不会再次显示");
            return true;
        }
        
        var login = $("<div class='login_tip'><span></span><a href='#'>你还没有登录，点此进行登录</a></div>");
        $(login).find("a").click(function(e) {
            a = $(e.target).css("display", "none");
            $(".login_tip span").text("正在检查登录状态，请稍候…");
            
            account.getUser(
                function(message) {
                    /// 获取用户成功的回调
                    console.log("用户已经登录");
                    $(".userinfo").text("已登录").slideDown();
                    $(".login_tip").remove();
                },
                function(error) {
                    console.log("用户尚未登录，执行登录流程");
                    account.login();
                    
                    $(".login_tip span").text("");
                    $(".login_tip a").css("display", "");
                }
            );
            
            
            return false;
        });
        
        
        $("body").append(login);
    },
    
    
    /**
     * 注销当前登录的用户
     */
    logout: function() {
        account.revoke();
        
        var c = app.config("geolocation");
        c.appLocalUID = "";
        app.config("geolocation", c);
        app.updateLocationConfig(c);
        
        page.change("page-index");
    },
    
    /**
     * 将带有 time-elapsed-readable 标记的元素内容修改为 readable
     * 原始的时间戳应保存在 data-timestamp 字段中
     * 
     * 如果传入了参数，则参数应为一个 DOM 对象，如果不传入参数，则更新所有的带有 time-elapsed-readable 的元素
     */
    updateTimeElapsedReadable: function () {
        var doms;
        if (arguments.length >= 1) {
            doms = [arguments[0]];
        }
        else {
            doms = $(".time-elapsed-readable");
        }
        
        var curTs = (new Date()).getTime();
        $(doms).each(function (k, v) {
            var ts = $(v).data("timestamp");
            var txt = "未知";
            if (!ts) {
                txt = "未知";
            }
            else {
                ts  = Math.round((curTs - ts) / 1000);
                txt = app._elapsed2Readable(ts);
            }
            
            $(v).text(txt);
        });
    },
    
    _elapsed2Readable: function (ts) {
        var txt = "（未知）";
        
        if (ts < 0) {
            txt = "未知时间";
        }
        if (ts < 5 * 60) {
            txt = "刚刚";
        }
        else if (ts < 3600) {
            txt = "约 " + Math.round(ts / 60) + " 分钟前";
        }
        else if (ts < 86400) {
            txt = "约 " + Math.round(ts / 3600) + " 小时前";
        }
        else {
            txt = "约 " + Math.round(ts / 86400) + " 天前";
        }
        
        return txt;
    },
};


var gslocation = {
    
    _mtime: 0,  /// 最后一次定位时间
    _locatedTimes: 0,   /// 总定位次数
    
    
    init: function() {
        window.pgs.stop();
        window.pgs.configure( gslocation.callbackFn, gslocation.failureFn, app.config("geolocation"));
        window.pgs.start(
            function() {console.log("位置记录器应该启动成功了");},
            function() {console.log("位置记录器启动失败");}
        );
        console.log("应用启动成功，当前时间：" + Date());
    },

    /**
    * This callback will be executed every time a geolocation is recorded in the background.
    */
    callbackFn: function(location) {
        //console.log('[js] BackgroundGeoLocation callback:  ' + location.latitude + ',' + location.longitude);
        console.log("[js] BackgroundGeoLocation callback: " + JSON.stringify(location));

        gslocation._locatedTimes = app.config("locatedTimes");
        app.config("locatedTimes", ++gslocation._locatedTimes);
        
        app.config("lastLocation", location);
        gslocation.updateUI(location);
        gslocation.logLocation(location);

    },
    
    failureFn : function(error) {
        console.log('BackgroundGeoLocation error: ' + JSON.stringify(error));
    },
    
    updateUI: function(location) {
        $("#location ul li").remove();
        $("#location ul").append("<li>经度:<span>" + location.longitude + "</span>");
        $("#location ul").append("<li>纬度:<span>" + location.latitude + "</span>");
        $("#location ul").append("<li>海拔:<span>" + location.altitude + "</span>米");
        $("#location ul").append("<li>速度:<span>" + location.speed + "</span>km/h");
        $("#location ul").append("<li>误差:<span>" + location.accuracy + "</span>米");
        $("#location ul").append("<li>定位时间:<span>" + (location.time / 1000) + "</span>");
        
        if (gslocation.mtime === 0) {
            $("#mtime").text("未定位");
        }
        else {
            $("#mtime").text((new Date(location.time)).toString());
            $("#mtime").append("<span>（已定位 " + gslocation._locatedTimes + " 次）</span>");
        }
    },
    
    /**
     * 获取最后一次上报的位置，如果失败返回 null
     */
    getLastLocation: function() {
        var loc = app.config("lastLocation");
        
        if (!loc) {
            loc = null;
        }
        
        /// 判断是否需要更新位置，如果本地保存的位置是 1 天前的，则更新之
        if (!loc || ((new Date()).getTime() - loc.rtime * 1000 > 86400 * 1000)) {
            $.ajax({
                url: "https://latitude.greensea.org:4433/api/v3/last_location.php?uid=" + account.getUID(),
                dataType: "json",
                data: {},
                method: "get",
                
                error: function(x, s, e) {
                    console.log("无法从服务器获取最新的位置信息: " + e);
                },
                
                success: function (d) {
                    if (d.code !== 0) {
                        console.log("无法从服务器获取最新的位置信息，服务器返回: " + d.message);
                    }
                    else {
                        console.log("从服务器获取到了最新的位置信息: " + JSON.stringify(d.data));
                        app.config("lastLocation", d.data);
                    }
                }
            });
        }
        
        
        return loc;
    },
    
    /**
     * 获取好友的最新位置（含本人的移动轨迹）
     * 获取成功后，好友的位置数据会保存在名为 friendLocations 的变量中
     * 
     * @param successCallback({tracks, friends})
     * @param failureCallback(error_msg)
     */
    syncFriendsLocation: function() {
        var successFn = function(f) {console.log("默认的成功回调函数被调用");};
        var failureFn = function(f) {console.log("默认的失败回调函数被调用");};
        
        if (arguments.length >= 1) {
            successFn = arguments[0];
        }
        if (arguments.length >= 2) {
            failureFn = arguments[1];
        }
            
        
        $.ajax({
            url: "https://latitude.greensea.org:4433/api/v3/friend/locations.php",
            dataType: "json",
            method: "get",
            data: {
                uid: account.getUID(),
            },
            
            error: function(x, s, e) {
                console.log("无法更新好友位置数据，网络错误：" + e);
                failureFn(e);
            },
            
            success: function(d) {
                if (d.code !== 0) {
                    console.log("无法更新好友位置数据，服务器返回错误: " + d.message);
                    failureFn(d.message);
                }
                else {
                    console.log("成功更新好友位置数据");
                    app.config("friendLocations", d.data.friends);
                    page.Friends.refreshFriend(d.data.friends);
                    page.Map.refreshFriend(d.data.friends);
                    page.Map.refreshTrack(d.data.tracks);
                    successFn(d.data);
                }
            },
        }); 
    },
    
    
    /**
     * 将火星坐标转换成地球坐标
     * 
     * @param object    火星坐标：{lat: xxx, lng: xxx}
     * @return object   地球坐标：{lat: xxx, lng: xxx}
     */
    earth2MarsCoor: function (earth) {
        var ee = 0.00669342162296594323;
        var a = 6378245.0;
        var pi = Math.PI;
        
        earth.lng = parseFloat(earth.lng);
        earth.lat = parseFloat(earth.lat);
        
        /// 是否在火星范围内
        /// FIMXE: 使用更精细的数据判断坐标是否位于火星上
        if (earth.lng < 72.004 || earth.lng > 137.8347) {
            console.log("坐标" + JSON.stringify(earth) + " 不在火星上，无须转换");
            return earth;
        }
        if (earth.lat < 0.8293 || earth.lat > 55.8271) {
            console.log("坐标" + JSON.stringify(earth) + " 不在火星上，无须转换");
            return earth;
        }
        
        var dLat = this._earth2MarsLatitude(earth.lng - 105.0, earth.lat  - 35.0);
        var dLng = this._earth2MarsLongitude(earth.lng - 105.0, earth.lat - 35.0);
        var radLat = earth.lat / 180.0 * pi;
        var magic = Math.sin(radLat);
        magic = 1 - ee * magic * magic;
        var sqrtMagic = Math.sqrt(magic);
        
        dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * pi);
        dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * pi);
        
        var ret = {
            lat: earth.lat + dLat,
            lng: earth.lng + dLng
        };
        
        console.log("火星坐标转换：将 " + JSON.stringify(earth) + " 转换为 " + JSON.stringify(ret));
        
        return ret;
    },
    
    _earth2MarsLatitude: function (x, y) {
        var ret;
        var pi = Math.PI;
        
        ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
        ret += (20.0 * Math.sin(6.0 * x * pi) + 20.0 * Math.sin(2.0 * x * pi)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(y * pi) + 40.0 * Math.sin(y / 3.0 * pi)) * 2.0 / 3.0;
        ret += (160.0 * Math.sin(y / 12.0 * pi) + 320 * Math.sin(y * pi / 30.0)) * 2.0 / 3.0;
        
        return ret;
    },
    
    _earth2MarsLongitude: function (x, y) {
        var ret;
        var pi = Math.PI;
        
        ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
        ret += (20.0 * Math.sin(6.0 * x * pi) + 20.0 * Math.sin(2.0 * x * pi)) * 2.0 / 3.0;
        ret += (20.0 * Math.sin(x * pi) + 40.0 * Math.sin(x / 3.0 * pi)) * 2.0 / 3.0;
        ret += (150.0 * Math.sin(x / 12.0 * pi) + 300.0 * Math.sin(x / 30.0 * pi)) * 2.0 / 3.0;
        
        return ret;
    }
};



var account = {
    /** 
     * 用户在我们的位置服务上的全局唯一编号
     */
    _uid: null,
    
    getUID: function() {
        if (account._uid) {
            return account._uid;
        }
        else {
            var uid = app.config("uid");
            if (!uid) {
                uid = account.genUID(16);
                app.config("uid", uid);
            }
            account._uid = uid;
        }
        
        return account._uid;
    },
    
    genUID: function(prefix_len) {
        var chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        var suffix = ((new Date()).getTime() / 1000 / 86400).toString(36).split(".")[0];
        var ret = "";
        for (i = 0; i < prefix_len; i++) {
            ret += chars[Math.round(Math.random() * (chars.length - 1))];
        }
        ret += suffix;
        return ret;
    },
    
    
    /**
     * 获取本地用户信息（不准确，建议仅用来粗略判断用户是否已经登录）
     */
    getUserLocal: function() {
        var user = app.config("user");
        if (user) {
            return user;
        }
        else {
            return false;
        }
    },
    
    /**
     * 获取当前登录用户信息
     */
    getUser: function() {
        successFn = function(msg) {console.log("获取当前登录用户信息默认成功回调：" + JSON.stringify(msg));};
        failureFn = function(err) {console.log("获取当前登录用户信息默认失败回调：" + JSON.stringify(err));};
        if (arguments.length >= 1) {
            successFn = arguments[0];
        }
        if (arguments.length >= 2) {
            failureFn = arguments[1];
        }
        
        $.ajax({
            url: "https://latitude.greensea.org:4433/api/getuser.php",
            method: "get",
            dataType: "json",
            data: {
                uid: account.getUID(),
            },
            
            success: function(data) {
                if (data.code === 0) {
                    console.log("成功从服务器获取当前登录用户信息: " + JSON.stringify(data.data));
                    
                    /// 刷新本地用户信息
                    app.config("user", data.data.user);
                    
                    /// 回调
                    successFn(data.data.user);
                }
                else {
                    failureFn("获取用户信息出错，服务器返回: " + data.message);
                }
            },
            
            error: function(x, s, e) {
                failureFn("获取用户信息出错: " + e);
            }
            
        });
    },
    
    
    /**
     * 进行登录
     */
    login: function() {
        account.revoke();
        
        var url = "https://latitude.greensea.org:4433/main/google_login.php?uid=" + account.getUID();
        console.log("将用户跳转到 " + url + " 进行登录");
        window.location = url;
    },
    
    /**
     * 撤销当前用户登录状态
     */
    revoke: function() {
        console.log("删除当前用户的登录状态");
        account._uid = null;
        app.config("user", undefined);
        app.config("uid", undefined);
    }
};


var page = {
    init: function() {
        this.Index.init();
        this.Map.init();
        this.Friends.init();
        this.Invite.init();
        this.Config.init();
        
        window.onpopstate = this.onPopState;
        
        page.displayPage("page-index");
    },
    
    onPopState: function(e) {
        var p = "";
        var matches = document.location.toString().match(/#(.+)$/);
        if (matches && matches.length > 1) {
            p = matches[1];
        }
        else {
            p = "page-index";
        }
              
        page.displayPage(p);
    },
    
    change: function(target) {
        $("#" + target).css("display", "");
        if (['page-config', 'page-invite', 'page-friends'].indexOf(target) >= 0) {
            var state = {};
            history.pushState(state, "", "#" + target);
        }
        
        this.displayPage(target);
    },
    
    toggleMenu: function (visible) {
        if (visible) {
            $("#latitude-menu").css("visibility", "visible");
        }
        else {
            $("#latitude-menu").css("visibility", "hidden");
        }
    },
    
    setTitle: function(title) {
        $("#title").text(title);
    },
    
    displayPage: function(p) {
        $("#page-index").css("display", "none");
        $("#page-friends").css("display", "none");
        $("#page-invite").css("display", "none");
        $("#page-map").css("visibility", "hidden");
        $("#page-config").css("display", "none");
        
        if (p != "page-map") {
            $("#" + p).css("display", "");
        }
        else {
            $("#" + p).css("visibility", "visible");
        }
        
        
        /// 在地图页面和首页禁止页面被滚动
        if (["page-index", "page-map"].indexOf(p) >= 0) {
            $("#latitude-nav").css("position", "fixed");   
        }
        else {
            $("#latitude-nav").css("position", "");
        }
        
        
        switch (p) {
            case "page-index":
                this.Index.refresh();
                this.toggleMenu(true);
                this.setTitle("我的纵横");
                break;
                
            case "page-map":
                this.Map.refresh();
                this.toggleMenu(true);
                this.setTitle("地图");
                
                
                /// 如果距离上次切换到地图的页面过去了 1 分钟，则强制刷新好友位置信息
                var ts = (new Date()).getTime();
                
                if (!app._data.lastChangeToMapTime) {
                    app._data.lastChangeToMapTime = 0;
                }
                
                if (ts - app._data.lastChangeToMapTime > 60 * 1000) {
                    console.log("距离上次切换到地图超过了一分钟，强制更新好友位置信息");
                    gslocation.syncFriendsLocation();
                }
                
                app._data.lastChangeToMapTime = ts;
                
                break;
                
            case "page-friends":
                this.Friends.refresh();
                this.toggleMenu(false);
                this.setTitle("好友列表");
                break;
                
            case "page-config":
                this.Config.refresh();
                this.toggleMenu(false);
                this.setTitle("设置");
                break;
                
            case "page-invite":
                this.Invite.refresh();
                this.toggleMenu(false);
                this.setTitle("邀请朋友");
                break;
                
            default:
                console.log("找不到页面：" + p);
                break;
        }
    },
    
    
    Index: {
        init: function() {
            $("#page-index button.login-with-google").click(function() {
                account.login();
                
                $("#page-index .not-logined .tips").text("正在将您带到谷歌登录页面，登录成功后请点击“我已登录”按钮");
                $("#page-index button.login-with-google").fadeOut();
                
                setTimeout(function() {
                    $("#page-index button.check-login").slideDown();
                }, 3000);
            });
            
            $("#page-index button.check-login").click(function() {
                $("#page-index button.check-login").css("display", "none");
                $("#page-index .check-login-loading").css("visibility", "visible");
                account.getUser(
                    function() {
                        /// 登录成功
                        var user = app.config("user");
                        
                        $("#page-index .not-logined").slideUp();
                        $("#page-index .logined").slideDown();
                        $("#page-index .logined .tips span").text(user.email);
                        
                        var s = app.config("geolocation");
                        s.appLocalUID = user.uid;
                        app.config("geolocation", s);
                        
                        app.updateLocationConfig(s);
                        
                        page.Index.refresh();   /// 在菜单上显示注销按钮
                    },
                    function(err) {
                        /// 登录失败
                        $("#page-index .not-logined .tips").text("登录失败，请重新登录，错误信息: " + err);
                        $("#page-index .check-login-loading").css("visibility", "hidden");
                        $("#page-index button.login-with-google").slideDown();
                    }
                );
            });
            
            
            this.refresh();
            
            console.log("page-index 初始化完成");
        },
        
        refresh: function() {
            /// 检查目前是否有账户已登录
            var user = account.getUserLocal();
            if (!user) {
                $("#page-index .not-logined").css("display", "");
                $("#page-index .logined").css("display", "none");
                
                $("#page-index button.login-with-google").css("display", "");
                $("#page-index button.check-login").css("display", "none");
                
                $(".mylatitude-logout").css("display", "none");
            }
            else {
                $("#page-index .not-logined").css("display", "none");
                $("#page-index .logined").css("display", "");
                $("#page-index .logined .tips span").text(user.email);
                
                $(".mylatitude-logout").css("display", "");
            }
        }
    },
    
    Map: {
        init: function(){
            console.log("初始化 Map 页面");
        },
        
        refresh: function(){
            page.Map.loadMap();
        },
        
        
        loadMap: function() {
            if (app.gmaps) {
                console.log("地图应该已经载入过了");
                return;
            }
            
            /// MDL 你就不能提供一个类似 onDocumentReady 的事件吗！?
            if ($("html").attr("class") == "mdl-js") {        
                console.log("MDL 应该已经加载完成了，载入地图");
                
                page.Map.resizeMap();
                
                var m = {
                    el: "#map",
                    lat: 24.010736,
                    lng: 106.579673,
                };
                
                var loc = gslocation.getLastLocation();
                if (loc) {
                    m.lat = loc.latitude;
                    m.lng = loc.longitude;
                }
                
                app.gmaps = new GMaps(m);
            }
            else {
                console.log("MDL 未加载完成，继续等待");
                setTimeout(page.Map.loadMap, 1000);
            }
        },
        
        resizeMap: function() {
            var topMargin = $("#latitude-nav").height();
            var height = $(document).height() - topMargin;
            console.log("将地图 div 上边距设为 " + topMargin);
            console.log("将地图 div 高度设置为 " + height);
            $("#page-map").css("top", topMargin + "px");
            $("#page-map").height(height);
            $("#map").height(height);
        },
        
        /**
         * 更新好友在地图上的位置
         */
        refreshFriend: function (friends) {
            if (!friends) {
                console.log("friends 数据为空，暂不更新地图上的好友数据");
                return;
            }
            if (!app.gmaps) {
                console.log("gmaps 对象为空，暂不更新地图上的好友数据");
                return;
            }
            
            /// 删除现有的位置
            app.gmaps.removeMarkers();
            
            /// 显示位置
            for (var k in friends) {
                var friend = friends[k];
                if (!friend.location) {
                    console.log(friend.email + " 的位置信息为空，不显示此好友在地图上的位置");
                    continue;
                }
                
                
                var marker = {};
                var tsElapsed = Math.round((new Date()).getTime() / 1000 - friend.location.rtime);
                var content = "<div><strong>" + friend.name + "</strong></div>";
                content += "<span class='time-elapsed-readable' data-timestamp='" + (friend.location.rtime * 1000)  +"'>" + app._elapsed2Readable(tsElapsed) + "</span>";
                content += "<div>精度 " + Math.round(friend.location.accurateness) + "m</div>";
                
                var loc = gslocation.earth2MarsCoor({lat: friend.location.latitude, lng: friend.location.longitude});
                marker.lat = loc.lat;
                marker.lng = loc.lng;
                
                marker.icon = friend.latitude_face;
                marker.infoWindow = {
                    content: content
                };
                
                app.gmaps.addMarker(marker);
                console.log("在地图上显示了 " + friend.email + " 的位置");
            }
        },
        
        /**
         * 更新我在地图上的移动轨迹
         */
        refreshTrack: function(tracks) {
            if (!tracks) {
                console.log("tracks 数据为空，暂不更新地图上的好友数据");
                return;
            }
            if (!app.gmaps) {
                console.log("gmaps 对象为空，暂不更新地图上的好友数据");
                return;
            }
            
            /// 删除现有的轨迹
            app.gmaps.removePolylines();
            
            
            
            if (tracks.length < 2) {
                console.log("只有 " + tracks.length + " 个位置信息，不会绘制轨迹");
                return;
            }
            
            console.log("根据 " + tracks.length + " 个位置点绘制轨迹");
            
            
            /// 火星坐标转换
            for (var k = 0; k < tracks.length; k++) {
                var loc = gslocation.earth2MarsCoor({lat: tracks[k].latitude, lng: tracks[k].longitude});
                tracks[k].latitude = loc.lat;
                tracks[k].longitude = loc.lng;
            }
            
            
            /// 建立轨迹数据
            var paths = [];
            for (var k = 1; k < tracks.length; k++) {
                paths.push([
                    [tracks[k - 1].latitude, tracks[k - 1].longitude],
                    [tracks[k].latitude, tracks[k].longitude]
                ]);
            }
            
            
            /// 绘制轨迹
            var opacity_step = 1.0 / tracks.length;
            var opacity = 1;
            for (var i = 0; i < paths.length; i++) {
                app.gmaps.drawPolyline({
                    path: paths[i],
                    strokeColor: "rgb(63,81,181)",
                    strokeOpacity: opacity,
                    storkeWeight: 6
                });
                
                if (opacity < 0.5) {
                    opacity = 0.5;
                }
                opacity -= opacity_step;
            }
        },
    },
    
        
    Friends: {
        init: function(){
            console.log("初始化 page-friends");
            //this.updateFriends();
        },
        
        refresh: function(){
            if (!app.gmaps) {
                page.Map.loadMap();
            }
            
            this.updateFriends();
        },
        
        updateFriends: function() {
            $.ajax({
                url: "https://latitude.greensea.org:4433/api/v3/friend/list.php?uid=" + account.getUID(),
                dataType: "json",
                method: "GET",
                data: {},
                
                beforeSend: function() {
                    $("#latitude-background-loading").css("visibility", "visible");
                },
                
                error: function(x, s, e) {
                    console.log("好友列表刷新失败，网络错误: " + e);
                },
                    
                success: function(d) {
                    if (d.code !== 0) {
                        console.log("好友列表刷新失败，服务器返回错误: " + d.message);
                    }
                    else {
                        console.log("成功获取好友数据");
                        page.Friends.refreshFriends(d.data);
                    }
                },
                
                complete: function() {
                    $("#latitude-background-loading").css("visibility", "hidden");
                },
            });
        },
        
        refreshFriends: function(friends) {
            this.refreshFriend(friends.friends);
            page.Map.refreshFriend(friends.friends);
            
            this.refreshSent(friends.sents);
            this.refreshValidate(friends.validates);
        },
        
        refreshFriend: function(friends) {
            var root = $("#friends-friend");
            $(root).find(".loading").css("display", "none");
            
            console.log("刷新 " + friends.length + " 个好友数据");
            
            /// 删除现有的卡片
            $(root).find(".friend").each(function (k, v) {
                if (($(v).attr("class") + "").split(" ").indexOf("base") >= 0) {
                    /// 什么都不用做
                }
                else {
                    $(v).remove();
                }
            });
            
            /// 添加好友数据
            for (var k in friends) {
                var friend = friends[k];
                var card = $(root).find(".base").clone();
                
                if (friend.google_face.length === 0) {
                    friend.google_face = "img/default-face.png";
                    friend.latitude_face = "img/default-face-48.png";
                }
                
                
                $(card).removeClass("base");
                $(card).find("img").attr("src", friend.google_face);
                $(card).find(".name").text(friend.name);
                if (friend.location) {
                    $(card).find(".last-located span").data("timestamp", friend.location.rtime * 1000);
                    
                    $(card).find(".face, .info").click(function() {
                        var lat = parseFloat(friend.location.latitude);
                        var lng = parseFloat(friend.location.longitude);
                        var loc = gslocation.earth2MarsCoor({lat: lat, lng: lng});
                        return function() {
                            if (app.gmaps) {
                                var center = {
                                    lat: loc.lat,
                                    lng: loc.lng
                                };
                                app.gmaps.setCenter(center);
                                page.change('page-map');
                            }
                        };
                    }());
                }
                
                app.updateTimeElapsedReadable($(card).find(".last-located span"));
                
                $(card).find("i").click(function() {
                    var obj = card;
                    var email = friend.email;
                    return function() {
                        $.ajax({
                            url: "https://latitude.greensea.org:4433/api/v3/friend/delete.php",
                            dataType: "json",
                            method: "post",
                            data: {
                                email: email,
                                uid: account.getUID(),
                            },
                            
                            beforeSend: function() {
                                $(obj).find(".action i").css("display", "none");
                                $(obj).find(".action .mdl-spinner").css("display", "");
                            },
                            
                            error: function(x, s, e) {
                                console.log("删除好友失败，网络错误: " + e);
                            },
                            
                            success: function(d) {
                                if (d.code !== 0) {
                                    console.log("删除好友失败，服务器返回错误: " + d.message);
                                }
                                else {
                                    $(obj).slideUp({
                                        done: function(){
                                            $(obj).remove();
                                            page.Friends.refresh();
                                        }
                                    });
                                }
                            },
                            
                            complete: function() {
                                $(obj).find(".action i").css("display", "");
                                $(obj).find(".action .mdl-spinner").css("display", "none");
                            }
                        });
                    };
                }());
                
                $(root).append(card);
            }
        },
        
        refreshSent: function(invites) {
            var root = $("#friends-sent");
            $(root).find(".loading").css("display", "none");
            
            console.log("刷新 " + invites.length + " 个已邀请好友数据");
            
            /// 删除现有的卡片
            $(root).find(".friend").each(function (k, v) {
                if (($(v).attr("class") + "").split(" ").indexOf("base") >= 0) {
                    /// 什么都不用做
                }
                else {
                    $(v).remove();
                }
            });
            
            /// 添加已发邀请好友数据
            for (var k in invites) {
                var invite = invites[k];
                var card = $(root).find(".base").clone();
                
                if (invite.invited_user.google_face.length === 0) {
                    invite.invited_user.google_face = "img/default-face.png";
                    invite.invited_user.latitude_face = "img/default-face-48.png";
                }
                
                $(card).removeClass("base");
                $(card).find("img").attr("src", invite.invited_user.google_face);
                $(card).find(".name").text(invite.invited_user.name);
                $(card).find(".invited-at span").data("timestamp", invite.ctime * 1000);
                app.updateTimeElapsedReadable($(card).find(".invited-at span"));
                
                
                
                $(card).find("i").click(function() {
                    var obj = card;
                    var invite_id = invite.invite_id;
                    return function() {
                        $.ajax({
                            url: "https://latitude.greensea.org:4433/api/v3/friend/revert_invite.php",
                            dataType: "json",
                            method: "post",
                            data: {
                                invite_id: invite_id,
                                uid: account.getUID(),
                            },
                            
                            beforeSend: function() {
                                $(obj).find(".action i").css("display", "none");
                                $(obj).find(".action .mdl-spinner").css("display", "");
                            },
                            
                            error: function(x, s, e) {
                                console.log("撤销邀请失败，网络错误: " + e);
                            },
                            
                            success: function(d) {
                                if (d.code !== 0) {
                                    console.log("撤销邀请失败，服务器返回错误: " + d.message);
                                }
                                else {
                                    $(obj).slideUp({
                                        done: function(){
                                            $(obj).remove();
                                            page.Friends.refresh();
                                        }
                                    });
                                }
                            },
                            
                            complete: function() {
                                $(obj).find(".action i").css("display", "");
                                $(obj).find(".action .mdl-spinner").css("display", "none");
                            }
                        });
                    };
                }());
                
                $(root).append(card);
            }
        },
        
        refreshValidate: function(invites) {
            var root = $("#friends-validate");
            $(root).find(".loading").css("display", "none");
            
            console.log("刷新 " + invites.length + " 个等待验证好友数据");
            
            /// 删除现有的卡片
            $(root).find(".friend").each(function (k, v) {
                if (($(v).attr("class") + "").split(" ").indexOf("base") >= 0) {
                    /// 什么都不用做
                }
                else {
                    $(v).remove();
                }
            });
            
            
            /// 添加等待验证好友数据
            for (var k in invites) {
                var invite = invites[k];
                var card = $(root).find(".base").clone();
                
                if (invite.sender_user.google_face.length === 0) {
                    invite.sender_user.google_face = "img/default-face.png";
                    invite.sender_user.latitude_face = "img/default-face-48.png";
                }
                
                $(card).removeClass("base");
                console.log(invite);
                $(card).find("img").attr("src", invite.sender_user.google_face);
                $(card).find(".name").text(invite.sender_user.name);
                $(card).find(".sent-at span").data("timestamp", invite.ctime * 1000);
                app.updateTimeElapsedReadable($(card).find(".sent-at span"));
                
                $(card).find(".accept i").click(function() {
                    var obj = card;
                    var invite_id = invite.invite_id;
                    return function() {
                        $.ajax({
                            url: "https://latitude.greensea.org:4433/api/v3/friend/accept.php",
                            dataType: "json",
                            method: "post",
                            data: {
                                invite_id: invite_id,
                                uid: account.getUID(),
                            },
                            
                            beforeSend: function() {
                                $(obj).find(".accept i").css("display", "none");
                                $(obj).find(".accept .mdl-spinner").css("display", "");
                            },
                            
                            error: function(x, s, e) {
                                console.log("同意请求失败，网络错误: " + e);
                            },
                            
                            success: function(d) {
                                if (d.code !== 0) {
                                    console.log("同意请求失败，服务器返回错误: " + d.message);
                                }
                                else {
                                    $(obj).slideUp({
                                        done: function(){
                                            $(obj).remove();
                                            page.Friends.refresh();
                                        }
                                    });
                                }
                            },
                            
                            complete: function() {
                                $(obj).find(".accept i").css("display", "");
                                $(obj).find(".accept .mdl-spinner").css("display", "none");
                            }
                        });
                    };
                }());
                
                $(card).find(".deny i").click(function() {
                    var obj = card;
                    var invite_id = invite.invite_id;
                    return function() {
                        $.ajax({
                            url: "https://latitude.greensea.org:4433/api/v3/friend/deny.php",
                            dataType: "json",
                            method: "post",
                            data: {
                                invite_id: invite_id,
                                uid: account.getUID(),
                            },
                            
                            beforeSend: function() {
                                $(obj).find(".deny i").css("display", "none");
                                $(obj).find(".deny .mdl-spinner").css("display", "");
                            },
                            
                            error: function(x, s, e) {
                                console.log("拒绝请求失败，网络错误: " + e);
                            },
                            
                            success: function(d) {
                                if (d.code !== 0) {
                                    console.log("拒绝请求失败，服务器返回错误: " + d.message);
                                }
                                else {
                                    $(obj).slideUp({
                                        done: function(){
                                            $(obj).remove();
                                            page.Friends.refresh();
                                        }
                                    });
                                }
                            },
                            
                            complete: function() {
                                $(obj).find(".deny i").css("display", "");
                                $(obj).find(".deny .mdl-spinner").css("display", "none");
                            }
                        });
                    };
                }());
                
                $(root).append(card);
            }
        }
    },
    
        
    Invite: {
        init: function() {
            $("#page-invite button").click(this.invite);
        },
        
        refresh: function() {
        },
        
        
        invite: function() {
            var name = $("#page-invite input[type=text]").val();
            if (!name || name.length === 0) {
                console.log("输入的账户名`" + name + "'是非法的");
                $("#page-invite .tips").text("请输入对方的谷歌账户邮箱地址");
                return;
            }
            
            $.ajax({
                url: "https://latitude.greensea.org:4433/api/v3/friend/invite.php",
                dataType: "json",
                method: "post",
                data: {
                    uid: account.getUID(),
                    invite: name,
                },
                
                beforeSend: function() {
                    $("#page-invite .loading").css("visibility", "visible");
                    $("#page-invite .tips").css("display", "none");
                },
                
                error: function(x, s, e) {
                    $("#page-invite .tips").text("网络错误: " + e);
                },
                
                success: function (d) {
                    if (d.code !== 0) {
                        $("#page-invite .tips").text("出错了: " + d.message);
                    }
                    else {
                        $("#page-invite .tips").text("邀请已发出，对方同意后你就可以看到对方了");
                    }
                },
                
                complete: function() {
                    $("#page-invite .loading").css("visibility", "hidden");
                    $("#page-invite .tips").css("display", "");
                }
            });
        },
    },
    
    Config: {
        init: function(){
            console.log("初始化 Config 页面");
        },
        
        refresh: function(){},
    },
    
        
};


/**
 * 打开一个 selection
 */
function showSelection(elem) {
    if (document.createEvent) {
        var e = document.createEvent("MouseEvents");
        e.initMouseEvent("mousedown", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
        elem[0].dispatchEvent(e);
    } else if (element.fireEvent) {
        elem[0].fireEvent("onmousedown");
    }
}


app.initialize();



$(document).ready(function() {
    console.log("document ready'");
    
    setTimeout(function() {$("#latitude-splash").fadeOut(1000);}, 100);
    
    page.init();
    
    setInterval(app.updateTimeElapsedReadable, 60 * 1000);
});



function configInit() {
    var c = app.config("geolocation");

    /// 初始化位置设置信息的显示
    $("#update-interval").val(c.minTime / 1000);
    $("#distance-filter").val(c.distanceFilter);
    $("#desired-accuracy").val(c.desiredAccuracy);
    $("#max-idle-time").val(c.maxIdleTime / 1000);
    $("#min-upload-interval").val(c.minUploadInterval / 1000);
    
    
    if ($("#upload-old-by-cell").prop("checked") !== c.uploadOldByCell) {
        $("#upload-old-by-cell").trigger("click");
        console.log("upload-old-by-cell clikced");
    }
    if ($("#is-debug").prop("checked") !== c.debug) {
        $("#is-debug").trigger("click");
        console.log("is-debug clikced");
    }
    

    $("#update-interval").change(function(e) {
        var interval = parseInt($(e.target).val());
        console.log("位置采集间隔（秒）：" + interval);
        
        var settings = app.config("geolocation");
        settings.minTime = interval * 1000;
        app.config("geolocation", settings);
        
        resetLocationConfig(settings);
    });
    
    $("#distance-filter").change(function(e) {
        var val = parseInt($(e.target).val());
        console.log("distance-filter: " + val);
        
        var s = app.config("geolocation");
        s.distanceFilter = val;
        app.config("geolocation", s);
        
        resetLocationConfig(s);
    });
    
    $("#desired-accuracy").change(function(e) {
        var val = parseInt($(e.target).val());
        console.log("desired-accuracy: " + val);
        
        var s = app.config("geolocation");
        s.desiredAccuracy = val;
        app.config("geolocation", s);
        
        resetLocationConfig(s);
    });
    
    $("#max-idle-time").change(function(e) {
        var val = parseInt($(e.target).val());
        console.log("max-idle-time: " + val);
        
        var s = app.config("geolocation");
        s.maxIdleTime = val * 1000;
        app.config("geolocation", s);
        
        resetLocationConfig(s);
    });
    
    $("#min-upload-interval").change(function(e) {
        var interval = parseInt($(e.target).val());
        console.log("min-upload-interval（秒）：" + interval);
        
        var c = app.config("geolocation");
        c.minUploadInterval = interval * 1000;
        app.config("geolocation", c);
        
        resetLocationConfig(c);
    });
    
    
    $("#upload-old-by-cell").change(function(e) {
        var s = $(e.target).prop("checked");
        console.log("upload-old-by-cell: " + s);
        
        var c = app.config("geolocation");
        c.uploadOldByCell = s;
        app.config("geolocation", c);
        
        resetLocationConfig(c);
    });
    
    $("#is-debug").change(function(e) {
        var s = $(e.target).prop("checked");
        console.log("is-debug: " + s);
        
        var c = app.config("geolocation");
        c.debug = s;
        app.config("geolocation", c);
        
        resetLocationConfig(c);
    });
    
}


function resetLocationConfig(settings) {
    window.pgs.stop();
    window.pgs.configure(gslocation.callbackFn, gslocation.failureFn, settings);
    window.pgs.start();
}

