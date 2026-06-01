import { Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'

@Injectable()
export class TxnNoGenerator {
  constructor(private dataSource: DataSource) {}

  async generate(prefix: 'TXN' | 'IN' | 'OUT'): Promise<string> {
    // DB 시퀀스로 채번 — 동시성 안전
    const [row] = await this.dataSource.query(
      `SELECT nextval('txn_seq') AS seq`
    )
    const seq = String(row.seq).padStart(6, '0')
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    return `${prefix}-${date}-${seq}`
  }
}
