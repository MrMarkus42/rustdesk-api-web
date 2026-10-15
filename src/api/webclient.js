import request from '@/utils/request'

export function config () {
  return request({ url: '/webclient/config', method: 'get' })
}

export function ticket () {
  return request({ url: '/webclient/ticket', method: 'post' })
}

export function peer (id) {
  return request({ url: '/webclient/peer', method: 'get', params: { id } })
}
