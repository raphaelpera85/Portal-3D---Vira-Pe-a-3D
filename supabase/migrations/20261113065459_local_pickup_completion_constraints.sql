alter table public.seller_purchase_orders
  drop constraint seller_purchase_orders_shipment_check,
  add constraint seller_purchase_orders_shipment_check check (
    (shipment_status = 'awaiting_shipment' and shipping_tracking_code is null and shipping_tracking_url is null
      and shipping_expected_date is null and shipping_shipped_at is null and shipping_delivered_at is null and completed_at is null)
    or (shipment_status = 'ready_for_pickup' and shipping_carrier = 'retirada_local' and shipping_tracking_code is null
      and shipping_tracking_url is null and shipping_expected_date is null and shipping_shipped_at is not null
      and shipping_delivered_at is null and completed_at is null)
    or (shipment_status = 'shipped' and shipping_tracking_code is not null and shipping_shipped_at is not null
      and shipping_delivered_at is null and completed_at is null)
    or (shipment_status = 'delivered' and shipping_shipped_at is not null and shipping_delivered_at is not null
      and completed_at is null and ((shipping_carrier = 'retirada_local' and shipping_tracking_code is null
        and shipping_tracking_url is null and shipping_expected_date is null) or shipping_tracking_code is not null))
    or (shipment_status = 'completed' and shipping_shipped_at is not null and shipping_delivered_at is not null
      and completed_at is not null and ((shipping_carrier = 'retirada_local' and shipping_tracking_code is null
        and shipping_tracking_url is null and shipping_expected_date is null) or shipping_tracking_code is not null))
  );

alter table public.custom_print_deliveries
  drop constraint custom_print_deliveries_check1,
  add constraint custom_print_deliveries_check1 check (
    (shipment_status = 'awaiting_shipment' and shipping_tracking_code is null and shipping_tracking_url is null
      and shipping_expected_date is null and shipping_shipped_at is null and shipping_delivered_at is null)
    or (shipment_status = 'ready_for_pickup' and shipping_carrier = 'retirada_local' and shipping_tracking_code is null
      and shipping_tracking_url is null and shipping_expected_date is null and shipping_shipped_at is not null
      and shipping_delivered_at is null)
    or (shipment_status = 'shipped' and shipping_tracking_code is not null and shipping_shipped_at is not null and shipping_delivered_at is null)
    or (shipment_status = 'delivered' and shipping_shipped_at is not null and shipping_delivered_at is not null
      and ((shipping_carrier = 'retirada_local' and shipping_tracking_code is null and shipping_tracking_url is null
        and shipping_expected_date is null) or shipping_tracking_code is not null))
  );
