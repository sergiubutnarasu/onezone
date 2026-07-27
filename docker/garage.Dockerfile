FROM dxflrs/garage:v2.3.0 AS garage

# The upstream garage image has no shell, so bootstrap logic can't run inside
# it directly. Rebase onto alpine (which has one) and copy the static garage
# binary over.
FROM alpine:3.20
COPY --from=garage /garage /garage
COPY docker/garage-entrypoint.sh /garage-entrypoint.sh
RUN chmod +x /garage-entrypoint.sh

ENTRYPOINT ["/garage-entrypoint.sh"]
