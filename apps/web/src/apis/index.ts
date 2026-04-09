import axios from 'axios'
export const timeout = 50000
export const serverApi = axios.create({
    baseURL: '/api/v1',
    timeout,
})
