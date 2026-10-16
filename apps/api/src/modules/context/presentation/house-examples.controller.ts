/**
 * `GET /house-examples` — daftar contoh rumah layar sambutan (P22-01). Publik, tanpa sesi: layar
 * sambutan tampil sebelum percakapan ada. Field kebutuhannya tidak dikirim; klien hanya butuh
 * id, gambar, dan teksnya — nilainya diterapkan server saat contoh dipilih.
 */
import { Controller, Get, Inject, Optional } from '@nestjs/common';
import { HOUSE_EXAMPLES, type HouseExample } from '../domain/house-example.js';

export interface HouseExampleDto {
  readonly id: string;
  readonly image: HouseExample['image'];
  readonly label: HouseExample['label'];
  readonly summary: HouseExample['summary'];
}

@Controller('house-examples')
export class HouseExamplesController {
  constructor(
    @Optional()
    @Inject(HOUSE_EXAMPLES)
    private readonly houseExamples: readonly HouseExample[] = [],
  ) {}

  @Get()
  list(): { examples: readonly HouseExampleDto[] } {
    return {
      examples: this.houseExamples.map(({ id, image, label, summary }) => ({
        id,
        image,
        label,
        summary,
      })),
    };
  }
}
