import re, sys, urllib.parse, urllib.request
from fontTools.ttLib import TTFont

chars = open('.tools/chars.txt').read().splitlines()[1]
print('chars', len(chars))
text = urllib.parse.quote(chars)
url = f"https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400&text={text}&display=swap"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'})
css = urllib.request.urlopen(req, timeout=30).read().decode()
urls = re.findall(r'url\((https://[^)]+)\)', css)
print('font urls', len(urls))
data = urllib.request.urlopen(urls[0], timeout=60).read()
open('.tools/subset.woff2','wb').write(data)
print('woff2 bytes', len(data))
font = TTFont('.tools/subset.woff2')
font.flavor = None
font.save('assets/noto-serif-sc-og.otf')
print('saved', __import__('os').path.getsize('assets/noto-serif-sc-og.otf'))
print('glyphs', font['maxp'].numGlyphs)
