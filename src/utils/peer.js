export const connectByClient = (id) => {
  //不新开窗口打开url protocol ,格式是 rustdesk://<id>
  // window.open(`rustdesk://${row.id}`)
  let a = document.createElement('a')
  a.href = `rustdesk://${id}`
  a.target = '_self'
  a.click()

}

// Opens the browser client for a device in a new tab.
export const connectByWeb = (id) => {
  const url = `${window.location.pathname}#/remote/${encodeURIComponent(String(id).replace(/\s/g, ''))}`
  window.open(url, '_blank', 'noopener')
}
