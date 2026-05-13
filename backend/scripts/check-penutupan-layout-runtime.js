const puppeteer = require('puppeteer')

async function main() {
  const browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  await page.setViewport({ width: 1366, height: 900 })
  await page.goto('http://localhost:5173/kasir/penutupan-kas', {
    waitUntil: 'networkidle2',
    timeout: 30000
  })

  const result = await page.evaluate(() => {
    const text = document.body.innerText
    const requiredText = [
      'HALAMAN 1',
      'I. Buku Induk Keuangan Perkara',
      'II. Buku Keuangan Konsinyasi',
      'III. Buku Keuangan Eksekusi',
      'IV. Saldo Pembukuan',
      'V. Saldo Kas',
      'VI. Selisih',
      'HALAMAN 2',
      'a. Rp100.000',
      'j. Rp100',
      'HALAMAN 3',
      'HALAMAN 4'
    ]

    return {
      missing: requiredText.filter(item => !text.includes(item)),
      pagePanels: document.querySelectorAll('.ns-document-page').length,
      romanRows: document.querySelectorAll('.ns-roman-row').length,
      cashRows: document.querySelectorAll('.ns-cash-row').length,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    }
  })

  await browser.close()

  if (result.missing.length || result.pagePanels < 4 || result.romanRows < 6 || result.cashRows !== 10 || result.overflow) {
    console.error(JSON.stringify(result, null, 2))
    process.exit(1)
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
