// ==UserScript==
// @name        pixivreader
// @author      edvakf
// @namespace   http://d.hatena.ne.jp/edvakf/
// @include     http://www.pixiv.net/new_illust.php*
// @include     http://www.pixiv.net/search.php*
// @include     http://www.pixiv.net/tags.php*
// @include     http://www.pixiv.net/bookmark_new_illust.php*
// @include     http://www.pixiv.net/ranking.php*
// @include     http://www.pixiv.net/ranking_log.php*
// @include     http://www.pixiv.net/member_illust.php*
// @include     http://www.pixiv.net/bookmark.php*
// @compatible  Opera, Chrome (as UserJS and extension), Safari (as extension)
// @licence     Public Domain
// ==/UserScript==

// Opera の場合は pixivreader.js という名前で保存。
// 新着や検索結果やランキングページで左上に pixiv のアイコンが出るので、それをクリックすると pixivreader が開きます。
// 下の方まで来ると自動的に次のページを読み込みます。また、新着一覧のページでは定期的に新しいイラストを読み込みます。
// s キーでダラダラ下に下がっていき、ちょっとでも気に入ったやつを片っ端から i キーで右に表示していく使い方が便利です。
// ショートカット:
// s : 左ペイン、一つ下へ
// a : 左ペイン、一つ上へ
// i : 大きな画像を右ペインに表示
// j : 右ペイン、一つ下へ
// k : 右ペイン、一つ上へ
// n 又は space : 右ペイン、下へスクロール
// m 又は shift+space : 右ペイン、上へスクロール
// l : 右ペイン、さらに大きな画像を表示（縦長の漫画で使うといい）
// h : 右ペイン、漫画を表示
// b : 右ペインの画像をブックマーク
// c 又は esc : ブックマーク編集終了・ヘルプを終了 (Chrome と Safari では esc は使えません)
// u : 右ペイン、画像を消す
// o : 右ペイン、画像の元ページを開く
// ? (shift+/) : ヘルプを表示

(function () {
  var debug = false;
  var location = window.location, XMLHttpRequest = window.XMLHttpRequest;
  var pathname = location.pathname;

  var mode = {
    new_illust : (pathname.indexOf('/new_illust.php') === 0),
    search : (pathname.indexOf('/search.php') === 0) || (pathname.indexOf('/tags.php') === 0) || (pathname.indexOf('/bookmark_new_illust.php') === 0),
    ranking : (pathname.indexOf('/ranking.php') === 0) || (pathname.indexOf('/ranking_log.php') === 0),
    bookmark : (pathname.indexOf('/bookmark.php') === 0) || (pathname.indexOf('/member_illust.php') === 0),
  };

  if (/\/((bookmark_)?new_illust|search|tags|ranking(_log)?|bookmark)\.php/.test(pathname) || 
      (/\/member_illust\.php/.test(pathname) && !/mode=(medium|big|manga)/.test(location.search))) {
    if (location.href.indexOf('pixivreader') >= 0) {
      document.documentElement.style.display = 'none';
      if (document.readyState !== 'complete') { // Opera 10.10 is 'interactive'->'complete', but Opera 10.5 and other browsers are 'loading'->'complete' (per spec)
        document.addEventListener('DOMContentLoaded', init, false);
      } else { // Greasemonkey
        init();
      }
    } else {
      if (document.readyState !== 'complete') {
        document.addEventListener('DOMContentLoaded', init_readerToggle, false);
      } else {
        init_readerToggle();
      }
    }
  }

  function init() {
    init_view();
    init_Thumb();
    init_Showcase();
    init_events();
    init_externals();
    init_readerToggle();
    document.documentElement.style.display = 'block';
  }

  // set up basic blocks and css
  function init_view() {
    addCSS([
      'html {overflow: hidden;}',
      '.pixivreader {position:fixed; margin:0; padding:0; width: 100%; height: 100%; top: 0; left: 0;}',
      '.pixivreader .focused {background-color:#FEF5CA !important; border: #8B7D6B solid 1px !important;}',
      '.pixivreader .scrollbar {position:absolute; width: 8px; border-radius: 4px; background-color:black; opacity: 0.4}',
      '.pixivreader .leftcol {position:relative; float: left; z-index: 100; width: 200px; height: 100%; overflow: hidden;}',
      '.pixivreader .leftcol ul {margin:5px 10px; width: 180px}',
      '.pixivreader .leftcol li {width:170px; margin:5px; background-color:white; text-align:center; border: #d0d0d0 solid 1px; padding-bottom: 3px;}',
      '.pixivreader .leftcol li.hidden {display:none;}',
      '.pixivreader .leftcol a {color:black;}',
      '.pixivreader .leftcol a:hover {background-color:#FEF5CA}',
      '.pixivreader .leftcol .bookmark_link {border: none;}',
      '.pixivreader .leftcol img {display:block; margin:0 auto; background-color:white;}',
      '.pixivreader .leftcol img.error {color: red; font-weight: bold;}',
      '.pixivreader .rightcol {float: left; width: 100%; height: 100%; margin-left: -200px; overflow: hidden; z-index: 0;}',
      '.pixivreader .rightcol > * {margin-left: 200px;}',
      '.pixivreader .rightcol .showcase {padding-bottom: 700px; margin-right: 10px;}',
      '.pixivreader .rightcol .showcase .item {background-color: white; position: relative; border: #d0d0d0 solid 1px; margin: 5px;}',
      '.pixivreader .rightcol .showcase .item .itemheader {border-bottom: #8B7D68 dashed 1px;}',
      '.pixivreader .rightcol .showcase .item .itemheader h2 a {font-weight: bold; font-size: 13pt;}',
      '.pixivreader .rightcol .showcase .item .itembody {padding: 5px;}',
      '.pixivreader .rightcol .showcase .item .itembody img {display:block; margin: 5px auto; max-width: 90%; max-height: 650px; background-size: 100%; border: solid #d0d0d0 1px; background-color:white;}',
      '.pixivreader .rightcol .showcase .item.large .itembody img {max-height: none;}',
      '.pixivreader .shade {position:absolute; left:0; top:0; width: 100%; height: 100%; background-color: black; opacity: 0.5; z-index: 1000;}',
      '.pixivreader .lightbox {position:absolute; z-index: 2000; background-color: white; width: 680px; margin-left: -340px; margin-top: -250px; left: 50%; top: 50%; }',
      '.pixivreader .lightbox .shortcuts{width: 100%; border: black solid 1px;}',
      '.pixivreader .lightbox .shortcuts thead{border-bottom: black solid 1px; background-color:#eee;}',
      '.pixivreader .lightbox .shortcuts th{padding-left: 0.5em; font-weight:bold !important;}',
      '.pixivreader .lightbox .shortcuts td{padding-left: 0.5em;}',
      '.pixivreader .lightbox form {padding: 10px;}',
      // from pixiv.js (modified)
      '.pixivreader .lightbox .bookmain_title{padding:4px;}',
      '.pixivreader .lightbox .bookmain_title_img{text-align:left;}',
      '.pixivreader .lightbox .box_main_sender{padding-right:0px;padding-bottom:0px;}',
      '.pixivreader .lightbox .box_one_body{padding:0px; max-width: 100%}',
      '.pixivreader .lightbox .box_one_body > dl{padding:4px 4px 0px 4px;margin:0px;line-height:24px;}',
      '.pixivreader .lightbox .box_one_body > dl:last-child{padding:4px;}',
      '.pixivreader .lightbox .box_one_body > dl > dd{margin-top:-24px;}',
      '.pixivreader .lightbox .box_one_body + div{display:none;}',
      '.pixivreader .lightbox .bookmark_recommend_tag{margin:4px;}',
      '.pixivreader .lightbox .bookmark_recommend_tag + .bookmark_recommend_tag{margin-top:16px;}',
      '.pixivreader .lightbox .bookmark_recommend_tag > span:first-child{display:none;}',
      '.pixivreader .lightbox .bookmark_recommend_tag > br{display:none;}',
      '.pixivreader .lightbox .bookmark_recommend_tag > ul{padding:0px;margin:0px;}',
      '.pixivreader .lightbox .bookmark_recommend_tag > ul + ul{margin-top:4px;}',
      '.pixivreader .lightbox .bookmark_recommend_tag > ul > li{padding:2px;margin-right:4px;}',
      '.pixivreader .lightbox .bookmark_recommend_tag > ul > li[selected]{border:2px solid #56E655;padding:0px;}',
      '.pixivreader .lightbox .bookmark_bottom{padding-bottom:4px;}',
      '.pixivreader .lightbox .bookmark_bottom input{margin:0px;}',
    ].join('\n'));

    // make viewer
    var pr = document.createElement('div');
    pr.className = 'pixivreader';

    // leftcol
    if (mode.new_illust || mode.search) {
      var leftcol = document.querySelector('.search_a2_result').cloneNode(true);
    } else if (mode.ranking) {
      var leftcol = document.createElement('div');
      var ul = document.createElement('ul');
      leftcol.appendChild(ul);
      forEach(document.querySelectorAll('.rankingZone'), function(r) {
        var li = r.querySelector('.r_left_img').cloneNode(true);
        li.className = '';
        var misc1 = document.createElement('div');
        misc1.innerHTML = r.querySelector('.r_left_text').textContent.replace(/^[\s\S]*?(\d+位)\s*?(前日\d位)?[\s\S]*$/, function($0, $1, $2) {return $1 + ($2 ? ' ('+$2+')' : '');}); 
        li.insertBefore(misc1, li.firstChild);
        var misc2 = document.createElement('div');
        misc2.innerHTML = r.querySelector('.r_right').textContent.replace(/^[\s\S]*(評価回数：\d+)　(スコア：\d+)[\s\S]*$/, '$1<br/>$2');
        li.appendChild(misc2);
        li.querySelector('a').appendChild(document.createTextNode(r.querySelector('.f16b a').textContent));
        ul.appendChild(li);
      });
    } else if (mode.bookmark) {
      var leftcol = document.querySelector('.display_works').cloneNode(true);
      forEach(leftcol.querySelectorAll('li'), function(li) {
        var e;
        if ((e = li.firstChild) instanceof window.HTMLInputElement) {
          li.removeChild(e);
        }
        if (e = li.querySelector('a label')) {
          e.parentNode.replaceChild(e.firstChild, e); // firstChild is a text node
        }
        if ((e = li.querySelector('.edit_link')) && (e = e.parentNode) instanceof window.HTMLAnchorElement) {
          e.parentNode.removeChild(e);
        }
      });
    }
    leftcol.className = 'leftcol';
    pr.appendChild(leftcol);

    // rightcol
    var rightcol = document.createElement('div');
    rightcol.className = 'rightcol';
    rightcol.innerHTML = '<div class="showcase"></div>';
    pr.appendChild(rightcol);

    document.body.innerHTML = '';
    document.body.appendChild(pr);
  }

  // Thumbnail list for left col
  var Thumb;
  function init_Thumb() {
    Thumb = {
      images : [],
      ids: {},
      pos : 0,
    };
    var leftcol = document.querySelector('.pixivreader .leftcol');
    forEach(leftcol.querySelectorAll('li'), function(li) {
      var img = li.querySelector('img');
      img.setAttribute('data-src', img.getAttribute('src'));
      var id = img.src.match(/\/(\d+)_s\.\w+$/)[1];
      Thumb.ids[id] = li;
      Thumb.images.push(li);
    });
    Thumb.images[0].className += ' focused';
    window.setTimeout(function() {// because methods are defined below
      Thumb.resetScrollbar();
      if (mode.new_illust) {
        Thumb.autoRenew(2, true);
        window.setInterval(Thumb.autoRenew, 60000);
      }
    }, 10);

    // methods
    Thumb.autoRenew = function Thumb_autoRenew(p, dontStop) {
      if (!p) p = 1;
      var maxpage = 4;
      function recursive(page) {
        window.setTimeout(function() {
          Thumb.fetch(page, function(html) {
            var status = Thumb.addIllusts(html);
            if (status.success && !status.empty && (status.allnew || dontStop) && page < maxpage) {
              recursive(page + 1);
            }
          });
        }, 1000);
      }
      recursive(p);
    };
    Thumb.fetchNextPage = function Thumb_fetchNextPage() {
      function no_op() {}; // no-op function
      if (mode.new_illust) {
        var page;
      } else {
        var m = location.href.match(/[?&]p=(\d+)/);
        var page = m ? +m[1] : 1;
      }
      Thumb.fetchNextPage = function Thumb_fetchNextPage2() {
        Thumb.fetchNextPage = no_op; // avoid parallel request
        page = mode.new_illust ? Math.ceil(Thumb.images.length / 20) + 1 : page + 1;
        Thumb.fetch(page, function(html) {
          var status = Thumb.addIllusts(html);
          log(JSON.stringify(status));
          if (!status.success || status.empty) {
            Thumb.fetchNextPage = no_op; // no-op
          } else if (status.allold) {
            Thumb.fetchNextPage = no_op;
            window.setTimeout(function() { // no new request for 15 sec
              Thumb.fetchNextPage = Thumb_fetchNextPage2;
            }, 15*1000);
          } else {
            Thumb.fetchNextPage = Thumb_fetchNextPage2;
          }
        });
      };
      Thumb.fetchNextPage();
    };
    Thumb.fetch = function Thumb_fetch(page, callback) {
      var url = location.href.replace(/([?&])p=\d+(&)?/, function($0, $1, $2) {return $1 === '?' ? '?' : $2 ? '&' : ''});
      url += url.indexOf('?') >= 0 ? '&' : '?';
      url += 'p=' + page;
      log(url);
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.onload = function() {
        callback(xhr.responseText);
      };
      xhr.send();
    };
    Thumb.addIllusts = function Thumb_addIllusts(html) { // returns the status of parsing
      try {
        if (mode.new_illust || mode.search) {
          html = html.match(/<div class="search_a2_result[\s\S]*?<\/div>/).toString();
        } else if (mode.ranking) {
          html = html.match(/<div class="rankingCenter">[\s\S]*?<div class="rankingRight">/).toString();
        } else if (mode.bookmark) {
          html = html.match(/<div class="display_works[\s\S]*?<div class="pager_ul">/).toString();
        }
      } catch(e) {
        log(e);
        return {success: false};
      }
      if (mode.new_illust || mode.search) {
        var r = /<li[^>]*><a href=".*?"><img src="(.*?)" alt="(.*?)"[^>]*>(.*?)<\/a>(.*?)<\/li>/g;
        var format = function format(m) {
          return {url: m[1], title: m[3], titleAndAuthor: m[2], misc2: m[4]};
        };
      } else if (mode.ranking) {
        var r = /<div class="rankingZone">[\s\S]*?<span class="f16b">(\d+位)<\/span>(?:<br \/>)?(前日\d+位)?[\s\S]*?<li class="r_left_img"><a href=".*?"><img src="(.*?)" alt="(.*?)" title=".*?" \/><\/a><\/li>[\s\S]*?<span class="f16b"><a href=".*?">(.*?)<\/a>[\s\S]*?(評価回数：\d+)　(スコア：\d+)[\s\S]*?<div class="clear"><\/div>/g;
        var format = function format(m) {
          return {url: m[3], title: m[5], titleAndAuthor: m[4], misc1: '<div>' + m[1] + (m[2] ? '('+m[2]+')' : '') + '</div>', misc2: '<div>' + m[6] + '<br />' + m[7] + '</div>'};
        };
      } else if (mode.bookmark) {
        var r = /<li.*?>(?:<input.*?>)?<a href=".*?"><img src="(.*?)" alt="(.*?)".*?>(?:<label.*?>)?(.*?)(?:<\/label>)?<\/a>(.*?)(?:<br \/><a href="bookmark_add\.php.*?"><span class="edit_link">編集<\/span><\/a>)?<\/li>/g;
        var format = function format(m) { // img src, title (and maybe author), title, misc2
          return {url: m[1], title: m[3], titleAndAuthor: m[2], misc2: m[4]};
        };
      }
      var m, f, allnew = true, empty = true, allold = true;
      while((m = r.exec(html)) && (f = format(m))) {
        empty = false;
        if (Thumb.add(f.url, f.title, f.titleAndAuthor, f.misc1, f.misc2)) { // not dup
          allold = false;
        } else { // dup
          allnew = false;
        }
      }
      if (empty) allnew = false;
      Thumb.resetScrollbar();
      Thumb.hideFarImg();
      return {success: true, empty: empty, allnew: allnew, allold: allold};
    };
    Thumb.add = function Thumb_add(url, title, titleAndAuthor, misc1, misc2) { // returns false if dup
      if (!titleAndAuthor) titleAndAuthor = title;
      var id = url.match(/\/(\d+)_s\.\w+$/)[1];
      if (Thumb.ids.hasOwnProperty(id)) return false;
      var li = document.createElement('li');
      li.className += ' hidden';
      li.innerHTML = (misc1||'') + '<a href="member_illust.php?mode=medium&illust_id='+id+'">' +
                     '<img data-src="'+url+'" alt="'+titleAndAuthor+'" title="'+titleAndAuthor+'" border="0">'+title+'</a>' + (misc2||'');
      leftcol.querySelector('ul').appendChild(li);
      var img = li.querySelector('img');
      img.onload = function() {
        img.setAttribute('height', img.height);
        img.setAttribute('width', img.width);
        img.onload = null;
      };
      Thumb.images.push(li);
      Thumb.ids[id] = li;
      return true;
    };
    Thumb.prev = function Thumb_prev() {
      var pos = Thumb.pos - 1;
      if (pos < 0) pos = 0;
      Thumb.focus(pos, true);
    };
    Thumb.next = function Thumb_next() {
      var pos = Thumb.pos + 1;
      if (pos >= Thumb.images.length) pos = Thumb.images.length - 1;
      Thumb.focus(pos, true);
    };
    Thumb.focus = function Thumb_focus(n, scroll) { // n is the position number or the DOM element, scroll is boolean
      var f = document.querySelector('.leftcol .focused');
      if (f) f.className = f.className.replace(' focused', '');
      Thumb.images[n].className += ' focused';
      Thumb.pos = n;
      Thumb.resetScrollbar();
      if (scroll) scroll_to(Thumb.images[n], leftcol, true);
      if (Thumb.pos + 38 > Thumb.images.length) {
        Thumb.fetchNextPage();
      }
    };
    Thumb.resetScrollbar = function Thumb_resetScrollbar() {
      Thumb.hideFarImg();
      var sc;
      if (!(sc = document.querySelector('.pixivreader .scrollbar.left'))) {
        sc = document.createElement('div');
        sc.style.left = '0';
        sc.className = 'scrollbar left';
        document.querySelector('.pixivreader').appendChild(sc);
      }
      var h = document.documentElement.clientHeight / Thumb.images.length;
      var mod = 0;
      if (h < 10) {
        mod = 10 - h;
        h = 10;
      }
      sc.style.height = h + 'px';
      sc.style.top = Thumb.pos / Thumb.images.length * (document.documentElement.clientHeight - mod) + 'px';
    };
    Thumb.hideFarImg = function Thumb_hideFarImg() { // release memory of images outside the viewport
      var i = Thumb.pos - 50;
      var l = Thumb.images.length;
      if (i - 1 >= 0) {
        var li = Thumb.images[i - 1];
        if (li.className.indexOf('hidden') < 0) {
          li.className += ' hidden';
          li.querySelector('img').src = '';
        }
      }
      for (var j = 0, k; j < 100; k = i + j++) {
        if (k >= 0 && k < l) {
          var li = Thumb.images[k];
          if (li.className.indexOf('hidden') >= 0) {
            li.className = li.className.replace(' hidden', '');
            var img = li.querySelector('img');
            img.src = img.getAttribute('data-src');
          }
        }
      }
      if (k < l) {
        var li = Thumb.images[k];
        if (li.className.indexOf('hidden') < 0) {
          li.className += ' hidden';
          li.querySelector('img').src = '';
        }
      }
    };
    Thumb.sendToShowcase = function Thumb_sendToShowcase () {
      var li;
      if (li = Thumb.images[Thumb.pos]) {
        var img = li.querySelector('img');
        Showcase.add(img.src, htmlEscape(img.alt), img.height, img.width);
      }
    };
  }

  // Thumbnail list for right col
  var Showcase;
  function init_Showcase () {
    Showcase = {
      images : [],
      pos : 0,
    };
    var rightcol = document.querySelector('.pixivreader .rightcol');

    // methods
    Showcase.add = function Showcase_add(url, title, height, width) {
      var id = url.match(/\/(\d+)_s\.\w+$/)[1];
      var largeurl = url.replace(/_s(\.\w+)$/, '_m$1');
      var item = document.createElement('div');
      item.className = 'item';
      item.innerHTML = '<div class="itemheader"><h2><a href="member_illust.php?mode=medium&illust_id='+id+'">'+title+'</a></h2></div>' +
                       '<div class="itembody"><img src="'+url+'" alt="'+title+'" title="'+title+'" border="0"></div>';
      document.querySelector('.pixivreader .rightcol .showcase').appendChild(item);
      var i = Showcase.images.push(item) - 1;
      if (i === 0) Showcase.focus(item);
      var img = item.querySelector('img');
      gradualLoadImg(img, url, largeurl,
        function onload() {
          Showcase.focus(item, true);
        },
        function onerror(img) {
          img.src = '';
          img.style.backgroundImage = 'url('+url+')';
          img.height = height || '';
          img.width = width || '';
          img.className += ' error';
          img.alt = 'Error!';
          Showcase.focus(item, true);
        }
      );
      Showcase.resetScrollbar();
    };
    Showcase.prev = function Showcase_prev() {
      if (Showcase.images.length === 0) return;
      var rect = Showcase.images[Showcase.pos].getBoundingClientRect();
      if (rect.top < 0 && rect.bottom > 0) {
        var pos = Showcase.pos;
      } else {
        var pos = Showcase.pos - 1;
        if (pos < 0) pos = 0;
      }
      Showcase.focus(pos, true);
    };
    Showcase.next = function Showcase_next() {
      if (Showcase.images.length === 0) return;
      var pos = Showcase.pos + 1;
      if (pos >= Showcase.images.length) {
        var rect = Showcase.images[Showcase.images.length - 1].getBoundingClientRect();
        if (rect.top < 0 && rect.bottom > 0) return;
        // else
        pos = Showcase.images.length - 1;
      }
      Showcase.focus(pos, true);
    };
    Showcase.remove = function Showcase_remove() {
      if (Showcase.images.length === 0) return;
      if (Showcase.images.length === 1) {
        var item = Showcase.images.pop();
        item.parentNode.removeChild(item);
      } else {
        var pos = Showcase.pos;
        var item = Showcase.images[pos];
        item.parentNode.removeChild(item);
        Showcase.images.splice(pos, 1);
        if (pos >= Showcase.images.length) pos = Showcase.images.length - 1;
        Showcase.focus(pos, true);
      }
    };
    Showcase.open = function Showcase_open() {
      if (Showcase.images.length === 0) return;
      window.open(Showcase.images[Showcase.pos].querySelector('h2 a').href);
    };
    Showcase.scrollDown = function Showcase_scrollDown(px) {
      if (!px) px = 150;
      rightcol.scrollTop += px;
      if (Showcase.images.length === 0) return;
      var rect = Showcase.images[Showcase.images.length - 1].getBoundingClientRect();
      if (rect.bottom - rect.top > document.documentElement.clientHeight) {
        if (rect.bottom < document.documentElement.clientHeight) rightcol.scrollTop -= (document.documentElement.clientHeight - rect.bottom) - 5;
      } else {
        if (rect.top < 0) rightcol.scrollTop += rect.top - 5;
      }
      Showcase.adjustFocus();
    };
    Showcase.scrollUp = function Showcase_scrollDown(px) {
      if (!px) px = 150;
      rightcol.scrollTop -= px;
      Showcase.adjustFocus();
    };
    Showcase.adjustFocus = function Showcase_adjustFocus() {
      if (Showcase.images.length <= 1) return;
      var pos = Showcase.pos;
      var item = Showcase.images[pos];
      var rect = item.getBoundingClientRect();
      if (rect.top - 5 <= 0 && rect.bottom > 0) return;
      if (rect.bottom <= 0) {
        while((item = Showcase.images[++pos]) && (rect = item.getBoundingClientRect())) {
          if (rect.top - 5 <= 0 && rect.bottom > 0) {
            return Showcase.focus(pos, false);
          }
        }
      } else if (rect.top > 0) {
        while((item = Showcase.images[--pos]) && (rect = item.getBoundingClientRect())) {
          if (rect.top - 5 <= 0 && rect.bottom > 0) {
            return Showcase.focus(pos, false);
          }
        }
      }
    };
    Showcase.focus = function Showcase_focus(n, scroll) { // n is the position number or the DOM element, scroll is boolean
      if (Showcase.images.length === 0) return;
      var f = document.querySelector('.rightcol .focused');
      if (f) f.className = f.className.replace(' focused', '');
      if (n instanceof window.HTMLElement) {
        n.className += ' focused';
        Showcase.pos = indexOf(document.querySelectorAll('.rightcol .item'), n);
      } else {
        Showcase.images[n].className += ' focused';
        Showcase.pos = n;
      }
      if (scroll) scroll_to(Showcase.images[Showcase.pos], rightcol);
      Showcase.resetScrollbar();
    };
    Showcase.resetScrollbar = function Showcase_resetScrollbar() {
      var sc;
      if (!(sc = document.querySelector('.pixivreader .scrollbar.right'))) {
        sc = document.createElement('div');
        sc.className = 'scrollbar right';
        sc.style.right = '0';
        document.querySelector('.pixivreader').appendChild(sc);
      }
      var h = document.documentElement.clientHeight / Showcase.images.length;
      var mod = 0;
      if (h < 10) {
        mod = 10 - h;
        h = 10;
      }
      sc.style.height = h + 'px';
      sc.style.top = Showcase.pos / Showcase.images.length * (document.documentElement.clientHeight - mod) + 'px';
    };
    Showcase.toggleLarge = function Showcase_toggleLarge() {
      if (Showcase.images.length === 0) return;
      var item = Showcase.images[Showcase.pos];
      if (item.className.indexOf('manga') >= 0) {
        if (item.className.indexOf('large') >= 0) {
          item.className = item.className.replace(' large', '');
          Showcase.adjustBottom(item);
        } else {
          item.className += ' large';
        }
        return;
      }
      var img = item.querySelector('.itembody img');
      var src = img.src;
      if (item.className.indexOf('large') >= 0) {
        item.className = item.className.replace(' large', '');
        gradualLoadImg(img, src, src.replace(/(\.\w+)$/, '_m$1'),
          function onload() {
            Showcase.adjustBottom(item);
          }
        );
      } else {
        item.className += ' large';
        gradualLoadImg(img, src, src.replace(/_m(\.\w+)$/, '$1'),
          function onload() {
            Showcase.focus(item);
          },
          function onerror() {
            item.className = item.className.replace(' large', '');
          }
        );
      }
    };
    Showcase.toggleManga = function Showcase_toggleManga() {
      if (Showcase.images.length === 0) return;
      var item = Showcase.images[Showcase.pos];
      if (item.className.indexOf('large') >= 0 && item.className.indexOf('manga') < 0) return;
      function quitManga() {
        item.className = item.className.replace(' manga', '');
        item.className = item.className.replace(' large', '');
        var img = item.querySelector('.itembody img');
        img.src = img.src.replace(/(?:_m|_p0)(\.\w+)$/, '_m$1');
        var s;
        while(s = img.nextSibling) {
          s.parentNode.removeChild(s);
        }
        Showcase.adjustBottom(item);
      }
      if (item.className.indexOf('manga') >= 0) {
        quitManga();
      } else {
        item.className += ' manga';
        var img = item.querySelector('.itembody img');
        var itembody = img.parentNode;
        var firstpage = img.src.replace(/_m(\.\w+)$/, '_p0$1');
        var id = img.src.match(/(\d+)_m\.\w+$/)[1];
        function addPage(src) {
          var page = document.createElement('img');
          page.src = src;
          itembody.appendChild(page);
        }
        gradualLoadImg(img, img.src, firstpage,
          function onload() {
            addPage(firstpage.replace(/_p0(\.\w+)$/, '_p1$1')); // load second page anyway
            var xhr = new XMLHttpRequest;
            xhr.open('GET', 'http://www.pixiv.net/member_illust.php?mode=manga&illust_id='+id+'&type=scroll', true);
            xhr.onreadystatechange = function() {
              if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                  var m, i = 0, r = /<a href="#(?:page\d+|manga_footer)"><img src="(.*?)"><\/a>/g;
                  while(m = r.exec(xhr.responseText)) {
                    if (++i > 2) addPage(m[1]);
                  }
                }
              }
            }
            xhr.send(null);
          },
          function onerror() {
            quitManga();
          }
        );
      }
    };
    Showcase.adjustBottom = function Showcase_adjustBottom(item) {
      var rect = item.getBoundingClientRect();
      if (rect.bottom < document.documentElement.clientHeight - 5) {
        rightcol.scrollTop -= (document.documentElement.clientHeight - 5 - rect.bottom);
        rect = item.getBoundingClientRect();
        if (rect.top > 5) {
          rightcol.scrollTop += (rect.top - 5);
        }
      }
    };
    Showcase.bookmarkCurrent = function Showcase_bookmarkCurrent() {
      if (Showcase.images.length === 0) return;
      LightBox.show();
      var current = Showcase.images[Showcase.pos];
      var id = current.querySelector('h2 a').href.match(/illust_id=(\d+)$/)[1];
      var xhr = new XMLHttpRequest;
      xhr.open('GET', 'http://www.pixiv.net/bookmark_add.php?type=illust&illust_id=' + id, true);
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            var bm = LightBox.get();
            if (!bm) return;
            bm.innerHTML = xhr.responseText.match(/<form[^>]*action="bookmark_add.php"[\S\s]*?<\/form>/);
            bm.querySelector('form').addEventListener('submit', function onsubmit(e) {
              e.preventDefault();
              var form = e.target;
              forEach(form.querySelectorAll('input[type="submit"]'), function(button) {
                button.disabled = true;
              });

              var xhr = new XMLHttpRequest;
              xhr.open('POST', form.action, true);
              xhr.setRequestHeader('content-type', 'application/x-www-form-urlencoded');
              xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                  if (xhr.status === 200) {
                    LightBox.hide();
                  } else {
                    forEach(form.querySelectorAll('input[type="submit"]'), function(button) {
                      button.disabled = true;
                      button.value = '失敗しました';
                    });
                  }
                }
              }
              xhr.send(form_to_query_string(form));
            }, false);

            // focus on comment field
            window.setTimeout(function() {
              var comment = document.getElementById('comment');
              comment.focus();
            }, 10);

            // for bookmarks (see bookmark_add_v4.js?20101028)
            location.href = "javascript:(function(){" +
                              "window.alltags = getAllTags();" +
                              "var input_tag = $('#input_tag')[0];" +
                              "var value     = input_tag.value;" +
                              "var arr       = value.split(/\s+|　+/);" +
                              "window.tag_chk(arr);" +
                              "window.bookmarkTagSort.init();" +
                            "}());"
          } else { // error
            LightBox.hide();
          }
        }
      };
      xhr.send(null);
    };
  }

  function init_events() { // shortcut and mouse
    function show_shortcuts() {
      LightBox.show();
      var box = LightBox.get();
      box.innerHTML = [
        '<table class="shortcuts">',
        '<thead><tr><th>ショートカットキー</th><th>動作</th></tr></thead>',
        '<tbody>',
        '<tr><td>s</td><td>左ペイン、一つ下へ</td></tr>',
        '<tr><td>a</td><td>左ペイン、一つ上へ</td></tr>',
        '<tr><td>i</td><td>大きな画像を右ペインに表示</td></tr>',
        '<tr><td>j</td><td>右ペイン、一つ下へ</td></tr>',
        '<tr><td>k</td><td>右ペイン、一つ上へ</td></tr>',
        '<tr><td>n 又は space</td><td>右ペイン、下へスクロール</td></tr>',
        '<tr><td>m 又は shift+space</td><td>右ペイン、上へスクロール</td></tr>',
        '<tr><td>l</td><td>右ペイン、さらに大きな画像を表示（縦長の漫画で使うといい）</td></tr>',
        '<tr><td>h</td><td>右ペイン、漫画を表示</td></tr>',
        '<tr><td>b</td><td>右ペインの画像をブックマーク</td></tr>',
        '<tr><td>c 又は esc</td><td>ブックマーク編集終了・ヘルプを終了 (Chrome と Safari では esc は使えません)</td></tr>',
        '<tr><td>u</td><td>右ペイン、画像を消す</td></tr>',
        '<tr><td>o</td><td>右ペイン、画像の元ページを開く</td></tr>',
        '<tr><td>? (shift+/)</td><td>ヘルプを表示</td></tr>',
        '<tr><td>(ショートカットなし)</td><td>pixivreader オン・オフ (<a href="javascript:(function(a){if(/http:\\/\\/www\\.pixiv\\.net/.test(location)&&(a=document.querySelector(&apos;a[title=&quot;Toggle pixivreader&quot;]&apos;)))a.click()}())">ブックマークレット</a>でやってください)</td></tr>',
        '</tbody>',
        '</table>',
      ].join('\n');
    }

    // keyboard handling
    var keys = {
      115 : Thumb.next, // s
      97 : Thumb.prev, // a
      105 : Thumb.sendToShowcase, // i
      106 : Showcase.next, // j
      107 : Showcase.prev, // k
      110 : Showcase.scrollDown, // n
      109 : Showcase.scrollUp, // m
      32 : Showcase.scrollDown, // space
      1032 : Showcase.scrollUp, // shift+space
      108 : Showcase.toggleLarge, // l
      104 : Showcase.toggleManga, // h
      98 : Showcase.bookmarkCurrent, // b
      99 : LightBox.hide, // c
      27 : LightBox.hide, // esc
      117 : Showcase.remove, // u
      111 : Showcase.open, // o
      63 : show_shortcuts, // ?
      1063 : show_shortcuts, // ? (shift+/)
    };

    window.addEventListener('keypress', function(e) {
      var a = document.activeElement;
      var keyCode = (e.keyCode || e.charCode || e.which) + 1000 * e.shiftKey + 10000 * e.ctrlKey + 100000 * e.altKey + 1000000 * e.metaKey;
      if (keyCode < 10000 && (a instanceof window.HTMLTextAreaElement || (a instanceof window.HTMLInputElement && (!a.type || a.type === 'text')))) return;
      if (keys.hasOwnProperty(keyCode)) {
        e.preventDefault();
        keys[keyCode]();
      }
    }, false);

    window.addEventListener('resize', function(e) {
      Showcase.focus(Showcase.pos, true);
    }, false);

    window.addEventListener('mousewheel', function(e) {
      // http://phpspot.org/blog/archives/2006/08/javascript_23.html
      if (e.detail) {
        var delta = -e.detail;
      } else if (e.wheelDelta) { // IE
        var delta = e.wheelDelta/40;
      }
      if (delta > 0) Showcase.scrollUp(75 * delta);
      if (delta < 0) Showcase.scrollDown(-75 * delta);
    }, false);
  }

  function init_externals() { // load scripts and stylesheet from pixiv
    // for bookmark
    var sc = document.createElement('script');
    var st = document.createElement('link');
    sc.src = 'http://source.pixiv.net/source/js/bookmark_add_v4.js?20101028';
    st.rel = 'stylesheet';
    st.href = 'http://source.pixiv.net/source/css/bookmark_add.css?20100720';
    var h = document.getElementsByTagName('head')[0];
    h.appendChild(sc);
    h.appendChild(st);
    // override jQuery.fn.ready so that it won't execute the argument function immediately
    // http://bugs.jquery.com/ticket/7366
    if (window.jQuery) {
      var ready = jQuery.fn.ready;
      jQuery.fn.ready = function(fn) {
        if (jQuery.isReady) {
          setTimeout(function() {
            ready.call(jQuery.fn, fn);
          }, 10);
          return this;
        } else {
          return ready.call(jQuery.fn, fn);
        }
      }
    }
  }

  function init_readerToggle() { // create a button to toggle pixivreader
    var box = document.createElement('div');
    box.style.width = '12px';
    box.style.height = '12px';
    box.style.position = 'fixed';
    box.style.top = 0;
    box.style.left = 0;
    box.style.zIndex = 10000;
    var href = location.href;
    href = href.indexOf('pixivreader') >= 0 ? 
             href.replace(/([?&])pixivreader(&)?/, function($0, $1, $2) {return $2 ? ($1 === '?' ? '?' : '&') : ''}) :
           href.indexOf('?') >= 0 ? 
             href.replace('?', '?pixivreader&') :
             href + '?pixivreader';
             box.innerHTML = '<a href="' + href + '" style="display:block;position:absolute;top:0;left:0;height:12px;width:12px;opacity:0.5;" title="Toggle pixivreader">'+
                             '<img src="/favicon.ico" border="0" width="12" height="12" alt="Toggle pixivreader" style="display:block;position:absolute;top:0;left:0;height:12px;width:12px;"></a>';
    document.body.appendChild(box);
  }

  // lightbox
  LightBox = {
    show : function LightBox_show() {
      LightBox.hide();
      var shade = document.createElement('div');
      shade.className = 'shade';
      shade.onclick = LightBox.hide;
      document.querySelector('.pixivreader').appendChild(shade);
      var bm = document.createElement('div');
      bm.className = 'lightbox';
      document.querySelector('.pixivreader').appendChild(bm);
    },
    hide : function LightBox_hide() {
      var bm = LightBox.get();
      var shade = document.querySelector('.pixivreader .shade');
      if (bm) bm.parentNode.removeChild(bm);
      if (shade) shade.parentNode.removeChild(shade);
    },
    get : function LightBox_get() {
      return document.querySelector('.pixivreader .lightbox');
    }
  };



  // utils
  var entities = {'<' : '&lt;', '>' : '&gt;', '"' : '&quot;', '\'' : '&apos;', '&' : '&amp;'};
  function htmlEscape(text) {
    return (text+'').replace(/<>'"&/, function(m){return entities[m]});
  }

  function addCSS(css) {
    var style = document.createElement('style');
    style.textContent = css;
    document.getElementsByTagName('head')[0].appendChild(style);
  }

  function forEach(list, fn) {
    Array.prototype.forEach.call(list, fn);
  }

  function indexOf(list, searchElement, fromIndex) {
    return Array.prototype.indexOf.call(list, searchElement, fromIndex);
  }

  function gradualLoadImg(img, small, large, onload, onerror) {
    var img2 = document.createElement('img');
    img2.style.visibility = 'hidden';
    img2.style.backgroundImage = 'url('+small+')';
    function callback() {
      img2.style.visibility = 'visible';
      window.clearInterval(timer);
      img2.parentNode.removeChild(img2);
      img.parentNode.replaceChild(img2, img);
      if (onload) onload(img);
      img2.onload = img2.onerror = null;
    }
    var useNatural = ('naturalHeight' in img); // true for safari, chrome, firefox
    var w = img2.width;
    var n = 0;
    var timer = window.setInterval(function() {
      if ((useNatural && img2.naturalHeight > 0 && img2.naturalWidth > 0) || (w !== 0 && img2.width !== w)) {
        callback();
        img2.onload = function() {img.style.backgroundImage = 'none';};
      }
      if (w === 0) w = img2.width;
      if (++n > 30) window.clearInterval(timer);
    }, 100);
    img2.onload = function() {
      callback();
      img2.style.backgroundImage = 'none';
    };
    img2.onerror = function() {
      window.clearInterval(timer);
      img.src = small;
      img2.parentNode.removeChild(img2);
      img2.onload = img2.onerror = null;
      if (onerror) onerror(img);
    };
    img2.src = large;
    document.body.appendChild(img2);
  }

  function scroll_to(elem, origin, middle) {
    if (!middle) {
      origin.scrollTop = elem.offsetTop - 5;
    } else {
      // bring an element into viewport (simplified version of http://d.hatena.ne.jp/edvakf/20100202/1265094445)
      //if (!origin) origin = document.documentElement;
      var outer = {left: 0, right: window.innerWidth, top: 0, bottom: window.innerHeight};
      var inner = elem.getBoundingClientRect();
      //var x = origin.scrollLeft;
      var y = origin.scrollTop;

      //x += (inner.left + inner.right) / 2 - (outer.left + outer.right) / 2;
      y += (inner.top + inner.bottom) / 2 - (outer.top + outer.bottom) / 2;

      //origin.scrollLeft = x;
      origin.scrollTop = y - 5;
    }
  }

  function form_to_query_string(form) {
    var qry = [];
    forEach(form.querySelectorAll('*[name]'), function(input) {// this is no way complete, but sufficient for this application
      if (input.name && input.value) {
        // does not check textarea, button, etc.
        switch (input.type) {
          case 'radio': if (input.disabled) break;
          case 'checkbox': if (!input.ckecked) break;
          //case 'hidden':
          //case 'text':
          //case '':
          default: qry.push(encodeURIComponent(input.name) + '=' + encodeURIComponent(input.value));
        }
      }
    });
    return qry.join('&');
  }

  function log(msg) {
    if (!debug) return;
    //if (window.opera) opera.postError.call(opera, Array.prototype.slice.call(arguments));
    //else 
    console.log.apply(console, Array.prototype.slice.call(arguments));
  }
})();
