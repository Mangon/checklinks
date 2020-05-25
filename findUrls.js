const cheerio = require('cheerio')
const request = require('superagent')
const baseUrl = 'https://smartprogram.baidu.com/docs/'
/**
 * [
 *     {
 *          page: '',
 *          links: [
 *              {
 *                  link: '',
 *                  status: 'true'
 *              },
 *              ...
 *          ]
 *      }
 * ]
 */
let result = []
let dealedLinks = []
let unDealedLinks = []

/**
 * @returns {Array} links return all http/https links in this website
 * @param {String} url the website
 */
async function getUrlContent (url) {
  try {
    const res = await request.get(url)
    if (res.status === 200) {
      let $ = cheerio.load(res.text)
      let hrefs = []
      $('a').each(function () { hrefs.push($(this).attr('href')) })
      let links = Array.from(new Set(hrefs.filter(item => { return item.length > 0 && (item.startsWith('http') || item.startsWith('/')) })))
      return links.map(link => {
        if (link.startsWith('/')) {
          return url.replace(/#.*$/g, '').replace(/[^/]\/[^/].*$/g, 'm') + link
        } else {
          return link
        }
      })
    } else {
      console.log(['skiped: ', url, res.status])
      return []
    }
  } catch (error) {
    console.log(['skiped: ', url, error])
    return []
  }
}
/**
 * @returns {Boolean} result whether the url is valid
 * @param {String} url the url which should be checked
 */
async function checkUrl (url) {
  try {
    const res = await request.get(url)
    if (res.status !== 200) {
      if (res && res.status === 302) {
        console.log(['302 status: ', url, res])
        return await checkUrl(res.header.position)
      } else {
        dealedLinks.push({link: url, status: false})
        return false
      }
    } else {
      dealedLinks.push({ link: url, status: true })
      return true
    }
  } catch (error) {
    dealedLinks.push({ link: url, status: false })
    return false
  }
}

async function dealLinks () {
  let currentLink = unDealedLinks.pop()
  let links = await getUrlContent(currentLink)
  let linkResult = []
  for (var i = 0; i < links.length; i++) {
    try {
      let status = false
      let linkIsDealed = false
      dealedLinks.forEach((element) => {
        if (element.link === links[i]) {
          linkIsDealed = true
          status = element.status
        }
      })
      if (!linkIsDealed) {
        status = await checkUrl(links[i])
      }
      linkResult.push({ link: links[i], status })
    } catch (error) {
      linkResult.push({ link: links[i], status: false })
    }
  }
  result.push({ page: currentLink, links: linkResult })
  let newLinks = linkResult.filter(item => {
    let isNewlink = item.link.startsWith(baseUrl) && item.status
    result.forEach(element => {
      if (element.page === item.link) {
        isNewlink = false
      }
    })
    return isNewlink
  }).map(element => {
    return element.link
  })
  unDealedLinks = Array.from(new Set([...unDealedLinks, ...newLinks]))
  if (unDealedLinks.length > 0) {
    console.log(`${new Date()} : Still have ${unDealedLinks.length} link(s) to deal`)
    console.log(`${new Date()} : ${result.length} page(s) have been dealed`)
    dealLinks()
  } else {
    let finalResult = []
    result.forEach((ele) => {
      ele.links.forEach(item => {
        if (item.status === false) {
          finalResult.push({ page: ele.page, link: item.link })
        }
      })
    })
    console.log(JSON.stringify(finalResult))
  }
}
unDealedLinks.push(baseUrl)
dealLinks()
