export interface AlertArea {
  alert_id: number
  id: number
  type: 'state' | 'cmas_geocode' | 'polygon' | 'circle' | 'area_description' | 'geocode'
  value: string | number[][] // polygon is [lat, lng][], circle is "lat,lng radius_km" string
}

export interface AlertText {
  alert_id: number
  id: number
  language: string
  type:
    | 'cap_headline'
    | 'cap_description'
    | 'cap_instruction'
    | 'cmac_short_text'
    | 'cmac_long_text'
  value: string
}

export interface Alert {
  id: number
  event: string
  severity: string
  urgency: string
  certainty: string
  status: string
  sender: string
  sent: string
  expires: string
  received: string
  last_modified: string
  is_cancelled: boolean
  is_out_of_date: boolean
  category: string
  msg_type: string
  response_type: string
  cap_identifier: string
  cmac_message_number: string
  cmac_referenced_message_number: string | null
  cmac_special_handling: string | null
  contact: string | null
  url: string
  areas: AlertArea[]
  texts: AlertText[]
}

export interface AlertResponse {
  alerts: Alert[]
}
