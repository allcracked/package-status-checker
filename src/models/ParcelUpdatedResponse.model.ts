export interface UpdateParcelProperty {
  guideId: string;
  property: string;
  updatedValue: string;
  updatedAt: number;
  updatedFrom: string;
}

export default interface ParcelUpdatedResponse {
  isChanged: boolean;
  whatChanged?: UpdateParcelProperty[];
}
